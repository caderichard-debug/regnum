import http from 'http'
import express from 'express'
import cors from 'cors'
import { InMemoryPlayerStore } from './store/playerStore.js'
import { InMemoryGameStore } from './store/gameStore.js'
import { InMemoryMatchmakingStore } from './store/matchmakingStore.js'
import { GameService } from './services/gameService.js'
import { MatchmakingService } from './services/matchmakingService.js'
import { playerRouter } from './routes/player.js'
import { matchmakingRouter } from './routes/matchmaking.js'
import { gameRouter } from './routes/game.js'
import { attachWebSockets } from './ws/wsServer.js'

const PORT = Number(process.env.PORT) || 3000

const playerStore = new InMemoryPlayerStore()
const gameStore = new InMemoryGameStore()
const matchmakingStore = new InMemoryMatchmakingStore()
const gameService = new GameService(gameStore, playerStore)
const matchmakingService = new MatchmakingService(matchmakingStore, playerStore, gameService)

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/player', playerRouter(playerStore))
app.use('/api/matchmaking', matchmakingRouter(matchmakingService, playerStore))
app.use('/api/game', gameRouter(gameService, playerStore))

const server = http.createServer(app)
attachWebSockets(server, gameService, playerStore)

server.listen(PORT, () => {
  console.log(`Regnum API listening on http://localhost:${PORT}`)
})
