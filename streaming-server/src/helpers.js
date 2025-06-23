const { connect } = require('./mongodbClient');

const coinIntervals = new Map();

// Start giving a coin (satoshi) per hour to a streamer
module.exports.coinHandlerStart = async (streamerName) => {
  if (coinIntervals.has(streamerName)) {
    console.log(`Coin handler already running for ${streamerName}`);
    return;
  }

  const db = await connect();
  const UsersCollection = db.collection('User');

  let streamer = await UsersCollection.findOne({ userName: streamerName });

  if (streamer) {
    console.log('Streamer found');

    const intervalId = setInterval(async () => {
      console.log('Reached interval')
      const updateResult = await UsersCollection.findOneAndUpdate(
        { userName: streamerName },
        { $inc: { satoshi: 1 } },
        { returnDocument: 'after' }
      );
      if (updateResult) {
        console.log(`Added one coin to ${streamerName}: ${updateResult.satoshi}`);
      }else{
        console.log('error')
      }
    }, 3600000);

    coinIntervals.set(streamerName, intervalId);
  } else {
    console.log('Streamer not found');
  }
};

// Stop giving a coin (satoshi) per hour to a streamer
module.exports.coinHandlerStop = (streamerName) => {
  let intervalId = coinIntervals.get(streamerName);
  if (intervalId) {
    clearInterval(intervalId);
    coinIntervals.delete(streamerName);
    console.log(`Stopped coin handler for ${streamerName}`);
  } else {
    console.log(`No coin handler running for ${streamerName}`);
  }
};