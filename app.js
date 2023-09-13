const express = require('express');
const multer = require('multer');
const path = require('path');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');


const app = express();
const port = process.env.PORT || 80;
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

AWS.config.update({
  accessKeyId: 'AKIA4UOHDTPK6AOKLOM2',
  secretAccessKey: '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',
  region: 'ap-south-1',
});

const s3 = new AWS.S3();

const storage = multer.memoryStorage();({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
  res.setHeader('Content-Type', 'application/javascript');
});

app.get('/retrieveFiles/:category', (req, res) => {
  const category = req.params.category;
  console.log(category);

  const params = {
    Bucket: 'docstore-service',
    Prefix: `,${category}/`, 
  };

  s3.listObjectsV2(params, (err, data) => {
    if (err) {
      console.error('Error listing objects in S3:', err);
      res.status(500).send('An error occurred while retrieving files.');
    } else {
      const files = data.Contents.map(file => ({
        name: file.Key, 
        url: `https://${params.Bucket}.s3.amazonaws.com/${file.Key}`, 
      }));

      const fileLinks = files.map(file => `
        <div style="border: 1px solid #ccc; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
          <a href="${file.url}" target="_blank" style="text-decoration: none; color: #007bff; margin-right: 100px;">${file.name}</a>
          <a href="/download/${encodeURIComponent(file.name)}" download style="text-decoration: none; color: #007bff;">Download</a>
          <a href="/delete/${category}/${encodeURIComponent(file.name)}" style="text-decoration: none; color: #ff0000;padding-left: 25px">Delete</a>
        </div>
      `);

      const formattedCategory = category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());

      const heading = `<h1 style ="text-align: center">${formattedCategory}</h1>`;

      const centeredContent = `
        <div style="display: flex; justify-content: center; align-items: center;">
          <div>
            ${heading}
            ${fileLinks.join('<br>')}
          </div>
        </div>
      `;

      res.send(centeredContent);
    }
  });
});

app.get('/delete/:category/:fileName', (req, res) => {
  const category = req.params.category;
  const fileName = req.params.fileName;


  const s3Key = `${category}/${fileName}`;
  const objectsToDelete = [{ Key: s3Key }];

  const deleteParams = {
    Bucket: 'docstore-service',
    Delete: {
      Objects: objectsToDelete,
    },
  };

  s3.deleteObjects(deleteParams, (err, data) => {
    if (err) {
      console.error('Error deleting file from S3:', err);
      res.status(500).send('An error occurred while deleting the file.');
    } else {
      console.log('File deleted successfully from S3:', s3Key);
      res.redirect(`/retrieveFiles/${category}`);
    }
  });
});

app.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;

  const s3Key = `${fileName}`;

  const s3Params = {
    Bucket: 'docstore-service',
    Key: s3Key,
    Expires: 3600, // URL expires in 1 hour
  };

  s3.getSignedUrl('getObject', s3Params, (err, url) => {
    if (err) {
      console.error('Error generating signed URL:', err);
      res.status(500).send('An error occurred while generating the download link.');
    } else {
  
      res.redirect(url);
    }
  });
});


app.post('/upload', upload.single('file'), (req, res) => {
  const uploadedFile = req.file;

  if (!uploadedFile) {
    return res.status(400).send('No file uploaded.');
  }

  const category = req.body.category;
  console.log("Server side")
  console.log(category)

  if (!category) {
    return res.status(400).send('Category is required.');
  }

  // Define the S3 key with the category prefix
  const s3Key = `${category}/${uploadedFile.originalname}`;

  // Define parameters for uploading to S3
  const params = {
    Bucket: 'docstore-service',
    Key: s3Key,
    Body: uploadedFile.buffer, // Use the file buffer as the body
  };

  // Upload the file to S3
  s3.upload(params, (err, data) => {
    if (err) {
      console.error('Error uploading file:', err);
      return res.status(500).send('Error uploading file to S3.');
    }

    console.log('File uploaded successfully to S3:', data.Location);
    // You can optionally perform further actions here, such as updating your website UI.

    res.send('File uploaded successfully.');
  });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
