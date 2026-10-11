const router = require('express').Router();
const { optionalVerifyJWT } = require('../middleware/authMiddleware');
const { cancelTicketController } = require('../controller/cancellationController');

router.post('/tickets/cancel', optionalVerifyJWT, cancelTicketController);
module.exports = router;
