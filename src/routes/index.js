'use strict';

const { Router } = require('express');
const productRoutes = require('./productRoutes');
const ticketRoutes  = require('./ticketRoutes');

const router = Router();

router.use('/products', productRoutes);
router.use('/tickets',  ticketRoutes);

module.exports = router;
