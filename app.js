const fs = require("fs");
const express = require("express");
const multer = require("multer");
const OAuth2Data = require("./credentials.json");
const fetch = require('node-fetch');
const Configstore = require('configstore');
const packageJson = require('./package.json');
const config = new Configstore(packageJson.name, {
  foo: 'bar'
});

config.set("authCode", {
  "000000": "",
  "111111": "",
  "222222": "",
  "333333": "",
})

var name, pic

const {
  google
} = require("googleapis");

const app = express();


const CLIENT_ID = OAuth2Data.web.client_id;
const CLIENT_SECRET = OAuth2Data.web.client_secret;
const REDIRECT_URL = OAuth2Data.web.redirect_uris[0];

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);
var authed = false;

let tokens = config.get("currentTokens") || {};

if (tokens.refresh_token) {
  oAuth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });
  authed = true;
}

// If modifying these scopes, delete token.json.
const SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile";

app.set("view engine", "ejs");

var Storage = multer.diskStorage({
  // destination: function (req, file, callback) {
  //   callback(null, "./images");
  // },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
  },
});

var upload = multer({
  storage: Storage,
}).single("file"); //Field name and max count


app.get("/teacher", async (req, res) => {
  let currentUser = config.get("currentUser") || {};
  var url = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });
  let isLogined = false;
  if(currentUser.id){
    isLogined = true;
  }
  res.render("index", {
    url: url,
    currentUser: currentUser.name,
    isLogined
  });
});

app.get("/", async (req, res) => {
  let tokens = config.get("currentTokens") || {};
  
  if (!authed) {
    res.render("teacherNotAuth");
  } else {
    let currentUser = config.get("currentUser") || {}
    res.render("success", {
      name: currentUser.name,
      pic: currentUser.picture,
      success: false
    });
  }
});

app.post("/upload", (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.log(err);
      return res.end("Something went wrong");
    } else {
      console.log(" req.file.path ",req.file.path);
      const drive = google.drive({
        version: "v3",
        auth: oAuth2Client
      });
      const fileMetadata = {
        name: req.file.filename
      };
      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path),
      };
      
      drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: "id",
        },
        (err, file) => {
          if (err) {
            // Handle error
            console.error(err);
          } else {
            fs.unlinkSync(req.file.path);
            let currentUser = config.get("currentUser") || {};
            res.render("success", {
              name: currentUser.name,
              pic: currentUser.pic,
              success: true
            })
          }
        }
      );
    }
  });
});

app.get('/logout', (req, res) => {
  config.delete("currentUser");
  config.delete("currentTokens");
  authed = false;
  res.redirect('/teacher')
})

app.get("/google/callback", function (req, res) {
  const code = req.query.code;
  if (code) {
    // Get an access token based on our OAuth code
    oAuth2Client.getToken(code, function (err, tokens) {
      if (err) {
        console.log("Error authenticating");
        console.log(err);
      } else {
        console.log("Successfully authenticated");
        config.set("currentTokens", tokens);
        authed = true;
        oAuth2Client.setCredentials(tokens);

        var oauth2 = google.oauth2({
          auth: oAuth2Client,
          version: "v2",
        });

        oauth2.userinfo.get(function (err, response) {
          if (err) {
            console.log(err);
          } else {
            config.set("currentUser", response.data)
            let allTokens = config.get("allTokens") || [];
            // lưu trữ tất cả token đã dùng trong hệ thống
            let exist = allTokens.find(item => item.id === response.data.id)
            if(!exist){
              allTokens.push({
                ...tokens,
                ...response.data || {}
              });
              config.set("allTokens", allTokens)
            }
          }
        });
        res.redirect("/");
      }
    });
  }
});

app.listen(5000, () => {
  console.log("App is listening on Port 5000");
});