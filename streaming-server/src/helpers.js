// Function to print the list of current streamers (rooms) to the console
module.exports.printRoomList = () => {
  const ids = Array.from(rooms.keys());
  if (ids.length > 0) {
    console.log(`Current streamers: ${ids.join(', ')}`);
  } else {
    console.log('No active streamers currently');
  }
};
