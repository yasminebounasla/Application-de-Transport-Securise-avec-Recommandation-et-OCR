import { seedPassengers } from './seeds/seedPassengers.js';
import { seedDrivers } from './seeds/seedDrivers.js';
import { seedTrajets } from './seeds/seedTrajets.js';
import { seedMlScores } from './seeds/seedMLscors.js';

async function main() {
    await seedPassengers();
    await seedDrivers();
    await seedTrajets();
    await seedMlScores();
}

main()
    .then(() => {
        console.log('Seeding done');
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
