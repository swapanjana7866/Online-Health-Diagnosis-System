import 'dotenv/config';
import mongoose from 'mongoose';
import Doctor from '../models/Doctor.js';

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Error: MONGO_URI is not set in backend/.env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB database successfully.\n');

    const args = process.argv.slice(2);
    const command = args[0] || '--list';

    if (command === '--list') {
      const doctors = await Doctor.find({}).sort({ name: 1 });
      console.log('========================================================================');
      console.log('              CAREPATH DOCTOR AVAILABILITY DATABASE CONTROL              ');
      console.log('========================================================================');
      console.log(`Found ${doctors.length} doctors in database:\n`);

      doctors.forEach((doc, idx) => {
        const statusBadge = doc.available ? '🟢 AVAILABLE  ' : '🔴 UNAVAILABLE';
        console.log(
          `${idx + 1}. [${statusBadge}] ${doc.name.padEnd(22)} | Specialty: ${doc.specialty.padEnd(18)} | Fee: $${doc.consultationFee} | ID: ${doc._id}`
        );
      });
      console.log('========================================================================\n');
      console.log('Usage tips:');
      console.log('  Toggle doctor status:  node scripts/manageDoctors.js --toggle "Dr. Maya Patel"');
      console.log('  Set doctor available:  node scripts/manageDoctors.js --set "Dr. Maya Patel" true');
      console.log('  Set doctor unavailable:node scripts/manageDoctors.js --set "Dr. Maya Patel" false');
      console.log('  Set all available:     node scripts/manageDoctors.js --set-all true');
    } else if (command === '--toggle') {
      const target = args[1];
      if (!target) {
        console.error('Please specify doctor name or ID. Example: node scripts/manageDoctors.js --toggle "Dr. Maya Patel"');
        process.exit(1);
      }

      const query = mongoose.Types.ObjectId.isValid(target)
        ? { _id: target }
        : { name: new RegExp(target.trim(), 'i') };

      const doctor = await Doctor.findOne(query);
      if (!doctor) {
        console.error(`Doctor "${target}" not found in database.`);
        process.exit(1);
      }

      doctor.available = !doctor.available;
      await doctor.save();

      console.log(`✓ UPDATED: Dr. ${doctor.name} (${doctor.specialty}) is now [${doctor.available ? '🟢 AVAILABLE' : '🔴 UNAVAILABLE'}] in MongoDB Atlas!`);
    } else if (command === '--set') {
      const target = args[1];
      const boolValue = args[2] === 'true' || args[2] === '1';

      if (!target) {
        console.error('Please specify doctor name/ID and boolean. Example: node scripts/manageDoctors.js --set "Dr. Maya Patel" false');
        process.exit(1);
      }

      const query = mongoose.Types.ObjectId.isValid(target)
        ? { _id: target }
        : { name: new RegExp(target.trim(), 'i') };

      const doctor = await Doctor.findOne(query);
      if (!doctor) {
        console.error(`Doctor "${target}" not found in database.`);
        process.exit(1);
      }

      doctor.available = boolValue;
      await doctor.save();

      console.log(`✓ UPDATED: Dr. ${doctor.name} (${doctor.specialty}) is now [${doctor.available ? '🟢 AVAILABLE' : '🔴 UNAVAILABLE'}] in MongoDB Atlas!`);
    } else if (command === '--set-all') {
      const boolValue = args[1] === 'true' || args[1] === '1';
      const result = await Doctor.updateMany({}, { available: boolValue });
      console.log(`✓ Set all ${result.modifiedCount} doctors to [${boolValue ? '🟢 AVAILABLE' : '🔴 UNAVAILABLE'}] in database.`);
    } else {
      console.log('Unknown command. Use: --list, --toggle, --set, or --set-all');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Database control script error:', err.message);
    process.exit(1);
  }
};

run();
