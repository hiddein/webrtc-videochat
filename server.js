const path = require("path")
const express = require("express")
const ACTIONS = require("./src/socket/actions")
const { validate, version } = require("uuid")
const app = express()
const server = require("http").createServer(app)
const io = require("socket.io")(server)

const PORT = process.env.PORT || 3001

const getClinentRooms = () => {
  const { rooms } = io.sockets.adapter

  return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4)
}

const shareRoomsInfo = () => {
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClinentRooms(),
  })
}

io.on("connection", (socket) => {
  shareRoomsInfo()

  socket.on(ACTIONS.JOIN, (config) => {
    const { room: roomID } = config
    const { rooms: joinedRooms } = socket

    if (Array.from(joinedRooms).includes(roomID)) {
      return console.log(`Already joined to ${roomID}`)
    }

    const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])

    clients.forEach((clientID) => {
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerId: socket.id,
        createOffer: false,
      })
      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        createOffer: true,
      })
    })

    socket.join(roomID)
    shareRoomsInfo()
  })

  const leaveRoom = () => {
    const { rooms } = socket

    Array.from(rooms).forEach((roomID) => {
      const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || [])
      clients.forEach((clientID) => {
        io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
          peerID: socket.id,
        })
        socket.emit(ACTIONS.REMOVE_PEER, {
          peerID: clientID.id,
        })
      })
      socket.leave(roomID)
    })

    shareRoomsInfo()
  }

  socket.on(ACTIONS.LEAVE, leaveRoom)
  socket.on("disconnecting", leaveRoom)
})

server.listen(PORT, () => {
  console.log("Server started!")
})
