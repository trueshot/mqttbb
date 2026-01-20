const redis = require('redis');
const client = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});



// Test data generation
function generateTestData(printerCount, jobsPerPrinter) {
  let jobs = [];
  for (let i = 1; i <= printerCount; i++) {
    for (let j = 1; j <= jobsPerPrinter; j++) {
      const tagData = {
        printerId: `printer${i}`,
        data: `Label ${j} for Printer ${i}`
      };
      jobs.push(JSON.stringify(tagData));
    }
  }
  return jobs;
}

// Push test data into the TagsToPrint list
function pushTestDataToRedis(testData) {
  testData.forEach((tag, index) => {
    client.rpush('TagsToPrint1', tag, (err, reply) => {
      if (err) {
        console.error('Error pushing test data to Redis:', err);
      } else {
        console.log(`Pushed ${tag} to TagsToPrint`);
      }
      // Close the client connection if it's the last item
      if (index === testData.length - 1) {
        setTimeout(() => {
          console.log('Finished pushing test data, closing Redis connection.');
          client.quit();
        }, 1000); // Delay to ensure all commands are processed
      }
    });
  });
}

// Example test data creation
const testData = generateTestData(3, 5); // Create test data for 3 printers, 5 jobs each
pushTestDataToRedis(testData);
