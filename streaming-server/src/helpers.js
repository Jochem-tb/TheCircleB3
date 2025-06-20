// Function to print the list of current streamers (rooms) to the console
module.exports.printRoomList = () => {
  const ids = Array.from(rooms.keys());
  if (ids.length > 0) {
    console.log(`Current streamers: ${ids.join(', ')}`);
  } else {
    console.log('No active streamers currently');
  }
};

module.exports.coinHandlerStart = async () =>{
  coinInterval = setInterval(async () => {
    //Add a coin evry hour
    //1000 * 60 * 60 miliseconds is one hour
    console.log('Added one coin')
  }, 1000)
}

module.exports.coinHandlerStop = async () =>{
  clearInterval(coinInterval)
}