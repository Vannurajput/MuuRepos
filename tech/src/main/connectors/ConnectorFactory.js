const GitConnector = require('./GitConnector');
const PrintConnector = require('./PrintConnector'); // [ADDED] Print connector
const GitZipConnector = require('./GitZipConnector');
const GitPullConnector = require('./GitPullConnector');
const GitFileConnector = require('./GitFileConnector');
const DbQueryRouter = require('./DbQueryRouter');
const DbListConnector = require('./DbListConnector');
const LocalConfigConnector = require('./LocalConfigConnector');

class ConnectorFactory {
  static create(type) {
    const normalized = typeof type === 'string' ? type.toUpperCase() : '';
    switch (normalized) {
      case 'GIT':
        return new GitConnector();
      case 'GIT_ZIP':
        return new GitZipConnector();
      case 'GIT_PULL':
        return new GitPullConnector();
      case 'GIT_FILE':
        return new GitFileConnector();
      case 'PRINT':
        return new PrintConnector();
      case 'POSTGRE':
      case 'POSTGRES':
      case 'POSTGRESQL':
      case 'MYSQL':
      case 'SQLSERVER':
      case 'SQL_SERVER':
      case 'MSSQL':
        return new DbQueryRouter();
      case 'GET_SAVED_CREDENTIALS':
        return new DbListConnector();
      case 'GET_LOCAL_CONFIG':
      case 'GET_FOLDER_DETAILS':
        return new LocalConfigConnector();
      default:
        return null;
    }
  }
}

module.exports = ConnectorFactory;
