import React, { useState, useEffect, useRef } from "react"
import socket from "../../socket/index"
import ACTIONS from "../../socket/actions"
import { useHistory } from "react-router-dom"
import { v4 } from "uuid"

export const Main = () => {
  const history = useHistory()
  const [rooms, setRooms] = useState([])
  const rootNode = useRef()

  useEffect(() => {
    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms = [] } = {}) => {
      if (rootNode.current) {
        setRooms(rooms)
      }
    })
  }, [])
  return (
    <div ref={rootNode}>
      <h1>Доступные комнаты</h1>

      <ul>
        {rooms.map((roomID) => (
          <li key={roomID}>
            {roomID}
            <button
              onClick={() => {
                history.push(`/room/${roomID}`)
              }}
            >
              Войти
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => {
          history.push(`/room/${v4()}`)
        }}
      >
        Добавить новую комнату
      </button>
    </div>
  )
}
