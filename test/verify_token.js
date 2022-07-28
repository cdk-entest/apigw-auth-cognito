import { CognitoJwtVerifier } from "aws-jwt-verify";
import token from "./token.json" assert { type: "json" };

async function verifyAccessToken(accessToken) {
  // verifier that expects valid access tokens:
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    tokenUse: "access",
    clientId: process.env.APP_CLIENT_ID,
  });
  // decoded token
  let decodedToken;
  try {
    decodedToken = await verifier.verify(accessToken);
    console.log("Token is valid. Payload:", decodedToken);
  } catch {
    decodedToken = {};
    console.log("Token not valid!");
  }
  return decodedToken;
}

const decoded = await verifyAccessToken(token.token)
  .then((data) => {
    console.log("decoded verified jwt token: ", JSON.stringify(data));
  })
  .catch((error) => {
    console.log(error);
  });
