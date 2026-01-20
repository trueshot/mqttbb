<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Presence Table</title>
  <style>
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table, th, td {
      border: 1px solid black;
    }
    th, td {
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    .button {
      padding: 5px 10px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .edit-button {
      background-color: green;
      color: white;
    }
    .add-button {
      background-color: red;
      color: white;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
  <h1>User Presence Table</h1>
  <table>
    <thead>
      <tr>
        <th>Username</th>
        <th>Redis Data</th>
        <th>DynamoDB Data</th>
        <th>DBF Pro Data</th>
        <th>DBF User Data</th>
      </tr>
    </thead>
    <tbody id="presenceTableBody">
      </tbody>
  </table>
  <script>
_app = {}
function getData() {
   console.log('getData function called') // Debug log
   axios
      .get('https://produceFlow.com/api/executeBatchAndGetJson')
      .then((response) => {
         console.log('Data received:', response.data)
         let obj = JSON.parse(response.data)
         _app.filteredDbfProData = obj.filteredDbfProData
         _app.filteredDbfUserData = obj.filteredDbfUserData
         _app.filteredDynamoDbData = obj.filteredDynamoDbData
         _app.presenceArray = obj.presenceArray
         _app.redisData = obj.redisData
         _app.filteredDbfProDataLookup = obj.filteredDbfProDataLookup
         _app.filteredDbfUserDataLookup = obj.filteredDbfUserDataLookup
         _app.filteredDynamoDbDataLookup = obj.filteredDynamoDbDataLookup
         _app.redisDataLookup = obj.redisDataLookup
         populateTable(_app.presenceArray)
      })
      .catch((error) => {
         console.error('Error fetching data:', error)
      })
}

function populateTable(presenceArray) {
   var tableBody = document.getElementById('presenceTableBody')
   tableBody.innerHTML = '' // Clear existing rows

   presenceArray.forEach(function (user, index) { // Add index as the second argument
      var row = document.createElement('tr')

      var usernameCell = document.createElement('td')
      usernameCell.textContent = user.username
      row.appendChild(usernameCell)

      function createButton(text, colorClass, username, index, dataType, status) { // Include index
         var button = document.createElement('button')
         button.className = 'button ' + colorClass
         button.textContent = text
         button.addEventListener('click', function () {
            handleButtonClick(username, index, dataType, status) // Pass index to the handler
         })
         return button
      }

      var redisCell = document.createElement('td')
      redisCell.appendChild(
         user.redisData
            ? createButton(
                 'Edit',
                 'edit-button',
                 user.username,
                 index, // Pass index
                 'redis',
                 'green',
              )
            : createButton('Add', 'add-button', user.username, index, 'redis', 'red'), // Pass index
      )
      row.appendChild(redisCell)

      var dynamoCell = document.createElement('td')
      dynamoCell.appendChild(
         user.filteredDynamoDbData
            ? createButton(
                 'Edit',
                 'edit-button',
                 user.username,
                 index, // Pass index
                 'dynamo',
                 'green',
              )
            : createButton('Add', 'add-button', user.username, index, 'dynamo', 'red'), // Pass index
      )
      row.appendChild(dynamoCell)

      var dbfProCell = document.createElement('td')
      dbfProCell.appendChild(
         user.filteredDbfProData
            ? createButton(
                 'Edit',
                 'edit-button',
                 user.username,
                 index, // Pass index
                 'dbfPro',
                 'green',
              )
            : createButton('Add', 'add-button', user.username, index, 'dbfPro', 'red'), // Pass index
      )
      row.appendChild(dbfProCell)

      var dbfUserCell = document.createElement('td')
      dbfUserCell.appendChild(
         user.filteredDbfUserData
            ? createButton(
                 'Edit',
                 'edit-button',
                 user.username,
                 index, // Pass index
                 'dbfUser',
                 'green',
              )
            : createButton(
                 'Add',
                 'add-button',
                 user.username,
                 index, // Pass index
                 'dbfUser',
                 'red',
              ),
      )
      row.appendChild(dbfUserCell)

      tableBody.appendChild(row)
   })
}

function handleButtonClick(username, index, dataType, status) { // Include index in the parameters
   console.log(
      'Button clicked for username:',
      username,
      'Index:',
      index, // Log the index
      'Data type:',
      dataType,
      'Status:',
      status,
   )
   let presence = _app.presenceArray[index]
   let dbfProData
   let dbfUserData
   let dynamoDbData
   let redisData 
   if (presence.filteredDbfProData){
      dbfProData = _app.filteredDbfProData[_app.filteredDbfProDataLookup[username]]
   }
   if (presence.filteredDbfUserData) {
      dbfUserData = _app.filteredDbfUserData[_app.filteredDbfUserDataLookup[username]]
   }
   if (presence.filteredDynamoDbData) {
      dynamoDbData = _app.filteredDynamoDbData[_app.filteredDynamoDbDataLookup[username]]
   }
   if (presence.redisData) {
      redisData = _app.redisData[_app.redisDataLookup[username]]
   }

   console.log(dbfProData, dbfUserData, dynamoDbData, redisData) // Log the data for
   debugger
   // Add your API call here
   /*
      axios.post('https://produceFlow.com/api/updateData', {
        username: username,
        index: index, // Include index in the API call
        dataType: dataType,
        status: status
      })
      .then(response => {
        console.log('API response:', response.data);
      })
      .catch(error => {
        console.error('API error:', error);
      });
      */
}

document.addEventListener('DOMContentLoaded', getData)
  </script>
</body>
</html>
