const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
    logger.error(error);
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';

    res.status(status).json({
        status,
        message,
        data: {}
    });
}

module.exports = errorHandler;