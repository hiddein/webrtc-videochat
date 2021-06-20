import { useCallback, useEffect, useRef } from "react"
import socket from "../socket"
import freeice from 'freeice'
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
          iceServers: freeice()
      })
    }
    socket.on(ACTIONS.ADD_PEER, handleNewPeer)
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
