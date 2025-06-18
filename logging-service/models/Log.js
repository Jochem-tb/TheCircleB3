const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: [
      "stream_start",
      "stream_stop",
      "follow_start",
      "follow_end",
      "message_sent",
      "gain_coin",
      "chatserver_start",
      "chatserver_stop"
    ],
    required: true
  },
  userId:    { type: String, required: true },      
  sessionId: { type: String, required: true },      
  timestamp: { type: Date,   default: Date.now },
  metadata:  { type: Object, default: {} }          
});

module.exports = mongoose.model("Log", logSchema);