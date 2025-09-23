const { Message, onlinestatusModel } = require("./models/chat");  // Import the Message model
const path = require('path');
const fs = require("fs");
const notificationModel = require("./models/notification");
const { PassThrough, pipeline } = require('stream');
const Admin = require("./models/admin")
const mongoose = require('mongoose');
const groups = {};
module.exports = (socket, io) => {

    const UPLOAD_DIR = path.join(__dirname, './tmp', 'uploads');
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
    const activeUploads = {};
    users = {};  
    // Register a user with their username and join a room
    socket.on('register', (username) => {
        users[username] = socket.id;
        socket.join(username);  // Join the user to a room named after their username
    });

    // share file using socket.io
    socket.on('start upload', ({ fileName, sender, recipient, message }) => {
        const uniqueFileName = `${Date.now()}-${fileName}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFileName);

        const passThrough = new PassThrough();
        const fileStream = fs.createWriteStream(filePath);

        activeUploads[socket.id] = { passThrough, fileStream, filePath, meta: { sender, recipient, message, fileName: uniqueFileName, original_name: fileName } };

        pipeline(
            passThrough,
            fileStream,
            async (err) => {
                if (err) {
                    console.error('Pipeline failed:', err);
                } else {
                    const { sender, recipient, message, fileName, original_name } = activeUploads[socket.id].meta;
                    console.log('File upload completed:', original_name);
                    const msg = new Message({
                        sender,
                        recipient,
                        message,
                        file: `uploads/${fileName}`,
                        fileName: original_name,
                    });
                    await msg.save();
                    io.to(sender).to(recipient).emit('receiveMessage', msg);
                }
                delete activeUploads[socket.id];
            }
        );
    });

    socket.on('file chunk', (chunk) => {
        const upload = activeUploads[socket.id];
        if (upload && upload.passThrough) {
            upload.passThrough.write(Buffer.from(chunk));
        }
    });

    socket.on('file chunk end', () => {
        const upload = activeUploads[socket.id];
        if (upload && upload.passThrough) {
            upload.passThrough.end(); // Signal the end of streaming
        }
    });

    // Send a message to a specific user
    socket.on('sendMessage', async (data) => {
        // console.log('Sending message:', data);
        const { sender, recipient, message, sendername } = data;
        // Save the message to MongoDB
        const newMessage = new Message({
            sender,
            recipient,
            message,
        });
        try {
            const savedMessage = await newMessage.save();
            // Emit the message to both users by joining the room
            console.log(`Emitting message to ${sender} and ${recipient}`);
            io.to(sender).to(recipient).emit('receiveMessage', savedMessage);
            
            const existingNotification = await onlinestatusModel.findOne({
                userid: recipient,
                status: "false",
            });
            console.log('existingNotification', existingNotification);
            if (existingNotification) {
                console.log('get notification')
                await notificationModel.create({ sender: sender, message: `You have a new message from ${sendername}`, messageType : "chat", seen: false, recipient: recipient });
                io.emit('sendNotification', {message: "new notifications"});
            }

        } catch (err) {
            console.error('Error saving message :', err);
        }
    });

    // Get all messages between two users
    socket.on('getMessages', async (data) => {
        const { user1, user2 } = data;
        try {
            // Find all messages exchanged between the two users
            const userMessages = await Message.find({
                $or: [
                    { sender: user1, recipient: user2 },
                    { sender: user2, recipient: user1 },
                ],
            }).sort({ timestamp: 1 });  // Sort messages by timestamp
            socket.emit('allMessages', userMessages);  // Send messages to the requesting user
        } catch (err) {
            console.error('Error retrieving messages:', err);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        for (let username in users) {
            if (users[username] === socket.id) {
                delete users[username];
                break;
            }
        }
    });

    // groupChat connections and messages

    socket.on('joinGroup', (groupId, username) => {
        socket.join(groupId);  // Join the group chat room
        // Create room if not exists
        if (!groups[groupId]) {
            groups[groupId] = {
                members: new Set(),
                createdAt: new Date(),
            };
        }
        // Add user to room's member list
        groups[groupId].members.add(username);
        console.log(`${username} joined room ${groupId}`);
        // Notify other users
        socket.to(groupId).emit('user-joined', { username });
    });

    socket.on('sendGroupMessage', async (data) => {
        const { sender, groupId, message } = data;
        const newMessage = new Message({
            sender,
            groupId,
            message,
        });
        try {
            const msg = await newMessage.save();
            // console.log('Group message saved:', newMessage);

            const objectId = new mongoose.Types.ObjectId(sender);
            const userData = await Admin.findOne({ _id: objectId });
            const messageToSend = {
                ...msg.toObject(),
                sender: [userData], // or you can pick specific fields from userData if needed
            };
        
            io.to(groupId).emit('receiveGroupMessage', messageToSend);  // Emit the message to the group
        } catch (err) {
            console.error('Error saving group message:', err);
        }
    });

    socket.on('startgroupupload', ({ fileName, sender, groupId, message }) => {
     
        const uniqueFileName = `${Date.now()}-${fileName}`;
        const filePath = path.join(UPLOAD_DIR, uniqueFileName);

        const passThrough = new PassThrough();
        const fileStream = fs.createWriteStream(filePath);

        activeUploads[socket.id] = { passThrough, fileStream, filePath, meta: { sender, groupId, message, fileName: uniqueFileName, original_name: fileName } };

        pipeline(
            passThrough,
            fileStream,
            async (err) => {
                if (err) {
                    console.error('Pipeline failed:', err);
                } else {
                    const { sender, groupId, message, fileName, original_name } = activeUploads[socket.id].meta;
                    console.log('File upload completed:', original_name);
                    const msg = new Message({
                        sender,
                        groupId,
                        message,
                        file: `uploads/${fileName}`,
                        fileName: original_name,
                    });
                    await msg.save();
                    const objectId = new mongoose.Types.ObjectId(sender);
                    const userData = await Admin.findOne({ _id: objectId});
                    const messageToSend = {
                        ...msg.toObject(),
                        sender: [userData], // or you can pick specific fields from userData if needed
                    };

                    console.log('msg.sender = ', msg);
                    io.to(groupId).emit('receiveGroupMessage', messageToSend);
                }
                delete activeUploads[socket.id];
            }
        );
    });

    // Get all messages between two users
    socket.on('getgroupMessages', async (groupId) => {
        console.log('groupId = 11', groupId)
        try {
            const userMessages = await Message.aggregate([
                { $match: { groupId: groupId } },
                {
                    $lookup: {
                        from: 'admins',
                        let: { senderId: { $toObjectId: '$sender' } },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } }
                        ],
                        as: 'sender'
                    }
                }
            ]);


            // console.log('Retrieved group messages:', userMessages);
            socket.emit('allgroupMessages', userMessages);  // Send messages to the requesting user
        } catch (err) {
            console.error('Error retrieving messages:', err);
        }
    });
};
