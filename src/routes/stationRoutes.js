const express = require('express');
const { getActiveStations } = require('../controller/stationController');

const router = express.Router();

router.get('/', getActiveStations);

module.exports = router;
