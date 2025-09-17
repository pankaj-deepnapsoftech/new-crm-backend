// const { status } = require("init");
const mongoose = require("mongoose");

const chatroomSchema = mongoose.Schema(
    {
        participants: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin', // Reference to the 'Users' collection
        }],
        groupName: {
            type: String,
            required: true,
        },
        groupAdmin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin', // Reference to the 'Users' collection
        },
        imageName: {
            type: String
        },
        // isGroupChat: {
        //     type: Boolean,
        //     default: false,
        // },
    },
    { timestamps: true }
);
const chatroomModel = mongoose.model("chat_room", chatroomSchema);

const messageSchema = mongoose.Schema({
    sender: {
        type: String,  // You can use String for username or ObjectId if you link it to a User model
        required: true,
    },
    recipient: {
        type: String,  // You can use String for username or ObjectId if you link it to a User model
        // required: true,
    },
    message: {
        type: String,
        // required: true,  // Ensures the message is not empty
    },
    read: {
        type: Boolean,
        default: false,  // Set to true when the message is read
    },
    file: {
        type: String,  // Path to the file if any
    },
    fileName: {
        type: String,  // Original name of the file
    },
    conversationId: {
        type: String,  // You can use a unique identifier (could be the combination of sender & recipient IDs)
    },
    groupId: {
        type: String,
    }

}, { timestamps: true });
const Message = mongoose.model('Message', messageSchema);



const userOnlineSchema = mongoose.Schema({
    userid: {
        type: String,  // You can use String for username or ObjectId if you
    },
    status: {
        type: String,  // You can use String for username or ObjectId if you link it to a User model
    }

}, { timestamps: true });
const onlinestatusModel = mongoose.model('onlineuser', userOnlineSchema);

module.exports = {
    chatroomModel,
    Message,
    onlinestatusModel
} 
