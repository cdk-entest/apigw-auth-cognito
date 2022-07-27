synth

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' synth
```

deploy

```bash
cdk --app 'npx ts-node --prefer-ts-exts bin/apigw-auth-app.ts' deploy
```

test api

```bash
export REGION=ap-southeast-1
export APIID=ubky9s17pk
export TOKEN=
```

```bask
curl -X GET https://$APIID.execute-api.$REGION.amazonaws.com/prod/book -H "Authorization: Bearer $TOKEN"
```
