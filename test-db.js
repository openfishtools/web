const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/editorstuff');
const Preset = mongoose.models.Preset || mongoose.model('Preset', new mongoose.Schema({}, { strict: false }));
Preset.findOne({ urls: { $elemMatch: { url: /studio\.cutefish\.my\.id/ } } })
  .then(p => { console.log(JSON.stringify(p, null, 2)); process.exit(0); })
  .catch(e => { console.log(e); process.exit(1); });
