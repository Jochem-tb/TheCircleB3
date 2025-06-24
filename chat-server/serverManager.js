import ChatRoom from './servers/chatRoom.js';

// Create a Map to store chat rooms, where the key is userId and the value is a ChatRoom instance
const rooms = new Map();

export function getOrCreateChatRoom(userId) {
    // If a room doesn't already exist for this userId, create and store a new ChatRoom
    if (!rooms.has(userId)) {
        console.log(`Creating chat room for user ${userId}`);
        rooms.set(userId, new ChatRoom(userId));
    }
    return rooms.get(userId);
}
