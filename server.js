const app = require('./server/app');

const PORT = process.env.PORT || 5025;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

module.exports = app;
