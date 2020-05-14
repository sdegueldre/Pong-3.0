const Field = require ('../common/BaseField');
const uuid = require('uuid/v1');

module.exports = class Room {
  constructor(socket){
    this.owner = socket;
    this.owner.playerNumber = 1;
    this.id = uuid();
    this.players = [this.owner];
    this.maxPlayers = 2;
    this.minPlayers = 2;
    this.tickers = [];
    socket.emit('joinedRoom', this.id);
    socket.emit('roomCreated', this.id);
    console.log('Created room with id', this.id);
  }

  join(socket){
    socket.playerNumber = this.players.length + 1;
    this.players.push(socket);
    socket.emit('joinedRoom');

    if(this.players.length >= this.minPlayers && !this.field){
      this.startGame();
    }

    if(socket.playerNumber > this.maxPlayers) {
      this.players[socket.playerNumber - 1].emit('gameStarted', {
        controlledPlayer: 0,
        initialBall: this.field.balls[0],
      });
    }
  }

  startGame(){
    console.log('Enough players have joined the room: starting the game...');
    this.field = new Field();
    this.players[0].on('playerMove', (position) => this.movePlayer(0, position));
    this.players[1].on('playerMove', (position) => this.movePlayer(1, position));

    this.players[0].emit('gameStarted', {
      controlledPlayer: 1,
      initialBall: this.field.balls[0],
    });
    this.players[1].emit('gameStarted', {
      controlledPlayer: 2,
      initialBall: this.field.balls[0],
    });

    this.broadcast('bonusSpawned', this.field.bonuses[0]);
    setInterval(() => {
      this.broadcast('ballSync', this.field.balls);
    }, 50);
    this.field.on('outOfField', () => {
      this.broadcast('playerScored', {
        balls: this.field.balls,
        score: this.field.score
      });
    });
    this.field.on('bonusCollected', () => {
      this.field.addBonus();
      this.broadcast('bonusCollected', {
        bonuses: this.field.bonuses,
        players: this.field.players
      });
    })
    this.tick(this.field);
  }

  movePlayer(playerNumber, position){
    this.field.players[playerNumber].y = position.y;
    // Tell other player about the move
    this.players.forEach((player, number) => {
      if(number === playerNumber) {
        return;
      }
      player.emit('playerMove', {
        // Players are indexed from 1 on the client
        playerNumber: playerNumber+1,
        y: position.y
      });
    })
  }

  tick(object){
    let lastTick = Date.now();
    this.tickers.push(setInterval(() => {
      let now = Date.now();
      let dt = now - lastTick;
      lastTick = now;
      object.update.bind(object)(dt/16.667);
    }, 10));
  }

  broadcast(type, data){
    for(let player of this.players)
      player.emit(type, data);
  }

  disconnect(socket){
    const index = this.players.indexOf(socket);
    if(index !== -1){
      this.players.splice(index, 1);
    }
    socket.emit('roomClosed');
    return index;
  }

  close(){
    this.broadcast('roomClosed');
    for(let ticker of this.tickers){
      clearInterval(ticker);
    }
  }
}
