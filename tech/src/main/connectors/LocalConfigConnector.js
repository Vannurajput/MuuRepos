const BaseConnector = require('./BaseConnector');
const LocalConfigService = require('../LocalConfigService');

class LocalConfigConnector extends BaseConnector {
    async execute(payload) {
        const service = new LocalConfigService();
        const action = payload?.action?.toUpperCase();

        switch (action) {
            case 'GET_LOCAL_CONFIG':
                return await service.getLocalConfig();

            case 'GET_FOLDER_DETAILS':
                return await service.getFolderDetails();

            default:
                throw new Error(`Unknown local config action: ${payload?.action}`);
        }
    }
}

module.exports = LocalConfigConnector;
