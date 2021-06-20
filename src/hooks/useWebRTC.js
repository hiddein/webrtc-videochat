import { useCallback, useEffect, useRef } from "react"
import socket from "../socket"
import freeice from "freeice"
import ACTIONS from "../socket/actions"
import { useStateWithCallback } from "./useStateWithCallback"

const LOCAL_VIDEO = "LOCAL_VIDEO"

export const useWebRTC = (roomID) => {
  const [clients, setClients] = useStateWithCallback([])

  const addNewClient = useCallback(
    (newClient, cb) => {
      if (!clients.includes(newClient)) {
        setClients((list) => [...list, newClient], cb)
      }
    },
    [clients, setClients]
  )

  const peerConnections = useRef({})
  const localMediaStream = useRef(null)
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null,
  })

  useEffect(() => {
    const handleNewPeer = async ({ peerID, createOffer }) => {
      if (peerID in peerConnections.current) {
        return console.log("Already connected")
      }

      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: freeice(),
      })

      peerConnections.current[peerID].onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate,
          })
        }
      }

      let tracksNumber = 0
      peerConnections.current[peerID].ontrack = ({
        streams: [remoteStream],
      }) => {
        tracksNumber++
        if (tracksNumber === 2) {
          addNewClient(peerID, () => {
            peerMediaElements.current[peerID].srcObject = remoteStream
          })
        }
      }
      localMediaStream.current.getTracks().forEach((track) => {
        peerConnections.current[peerID].addTrack(
          track,
          localMediaStream.current
        )
      })

      if (createOffer) {
        const offer = await peerConnections.current[peerID].createOffer()

        await peerConnections.current[peerID].setLocalDescription(offer)
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer,
        })
      }
    }
    socket.on(ACTIONS.ADD_PEER, handleNewPeer)
  }, [])

  useEffect(() => {
    const setRemoteMedia = async ({ peerID, sessionDescription }) => {
      await peerConnections.current[peerID].setRemoteDescripton(
        new RTCSessionDescription()
      )

      if (sessionDescription.type === "offer") {
        const answer = await peerConnections.current[peerID].createAnswer()
        await peerConnections.current[peerID].setLocalDescription(answer)
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        })
      }
    }
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)
  }, [])

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({ peerID, iceCandidate }) => {
      peerConnections.current[peerID].addIceCandidate(
        new RTCIceCandidate(iceCandidate)
      )
    })
  }, [])

  useEffect(() => {

    socket.on(ACTIONS.REMOVE_PEER, ( { peerID })=> {
        if(peerConnections.current[peerID]){
            peerConnections.current[peerID].close()
        }

        delete peerConnections.current[peerID]
        delete peerMediaElements.current[peerID]
        setClients(list => list.filter( c => c!== peerID))

    })
  }, [])

  useEffect(() => {
    const startCapture = async () => {
      localMediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 1280,
          height: 720,
        },
      })
      addNewClient(LOCAL_VIDEO, () => {
        const localVideoElement = peerMediaElements.current[LOCAL_VIDEO]

        if (localVideoElement) {
          localVideoElement.volume = 0
          localVideoElement.srcObject = localMediaStream.current
        }
      })
    }

    startCapture()
      .then(() => socket.emit(ACTIONS.JOIN, { room: roomID }))
      .catch((e) => console.log(e))

    return () => {
      localMediaStream.current.getTracks().forEach((track) => track.stop())

      socket.emit(ACTIONS.LEAVE)
    }
  }, [roomID])

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node
  }, [])

  return {
    clients,
    provideMediaRef,
  }
}
