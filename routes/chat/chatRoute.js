const express = require('express');
const { createGroup, changeOnlineStatus, getChatGroup, getAlluser, getNotifications, getuser } = require('../../controllers/chat/Chat');
const { checkAccess } = require('../../helpers/checkAccess');

const { createChatValidator, validateHandler } = require('../../validators/chat/chat');

const { chatimage } = require('../../utils/multer');
const router = express.Router();

// router.post('/createGroup', createChatValidator(), validateHandler, createGroup);

router.post('/createGroup', chatimage.single('image'), createGroup);
router.get('/fetchGroup/:id', getChatGroup);
router.get('/allNotifications/:userId', getNotifications);

router.get('/all-user/:userId', getAlluser);
router.post('/changestatus', changeOnlineStatus);

router.get('/getuser/:userId', getuser);


module.exports = router;