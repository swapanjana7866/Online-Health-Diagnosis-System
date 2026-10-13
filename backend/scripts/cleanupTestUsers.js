import 'dotenv/config';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
const result = await mongoose.model('User').deleteMany({
  email: { $in: ['testsignupfix3@gmail.com', 'testproxycheck9@gmail.com'] }
});
console.log('Deleted test users:', result.deletedCount);
await mongoose.disconnect();
