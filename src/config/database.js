'use strict';

const knex = require('knex');
const knexConfig = require('../../knexfile');
const env = require('./env');

const environment = env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;

const db = knex(config);

module.exports = db;
