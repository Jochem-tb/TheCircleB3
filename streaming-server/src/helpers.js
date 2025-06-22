const { connect } = require('./mongodbClient');

let coinInterval;

// Function to print the list of current streamers (rooms) to the console
module.exports.printRoomList = () => {
  const ids = Array.from(rooms.keys());
  if (ids.length > 0) {
    console.log(`Current streamers: ${ids.join(', ')}`);
  } else {
    console.log('No active streamers currently');
  }
};

module.exports.coinHandlerStart = async (streamerId) =>{
  const db = await connect();
  console.log('Looking up user with id:', streamerId);
  const UsersCollection = await db.collection('Users')
  let streamer = await UsersCollection.findOne({ streamerId });
  if(streamer){
    console.log('The streamer: ')
    console.log(streamer)
    
    //Add a coin evry hour
    coinInterval = setInterval(async () => {
      streamer.coins += 1;
      UsersCollection.findOneAndUpdate({ streamerId: streamerId }, { "$set": { coins: streamer.coins } })
      console.log('Added one coin')
      console.log(streamer.coins)
    }, 1000 * 60 * 60)
  }else{
    console.log('streamer not found')
  }
}

module.exports.coinHandlerStop = async () =>{
  clearInterval(coinInterval)
}