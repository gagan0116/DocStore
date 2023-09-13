const express = require('express');
const multer = require('multer');
const path = require('path');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');


const app = express();
const port = 3000;

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
        name: file.Key, // File name
        url: `https://${params.Bucket}.s3.amazonaws.com/${file.Key}`, // S3 file URL
      }));

      const fileLinks = files.map(file => `
        <div style="border: 1px solid #ccc; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
          <a href="${file.url}" target="_blank" style="text-decoration: none; color: #007bff; margin-right: 100px;">${file.name}</a>
          <a href="/download/${encodeURIComponent(file.name)}" download style="text-decoration: none; color: #007bff;">Download</a>
        </div>
      `);

      const formattedCategory = category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());

      // Create a heading with the formatted category name
      const heading = `<h1 style ="text-align: center">${formattedCategory}</h1>`;

      // Wrap the content in a centered div
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

// Add a route for file downloads
app.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;

  // Set the S3 object key based on the category and file name
  const s3Key = `${fileName}`;

  // Create a signed URL for the S3 object
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
      // Redirect the user to the signed URL for downloading the file
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
  console.log(`Server is running on http://localhost:${port}`);
});
