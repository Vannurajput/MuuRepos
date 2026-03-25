module.exports = {
  getPassword: jest.fn().mockResolvedValue('mock-password'),
  setPassword: jest.fn().mockResolvedValue(),
  deletePassword: jest.fn().mockResolvedValue()
};
