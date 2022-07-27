"""
haimtran 27 JUL 2022
get and validate cognito user token, 
then integrate with lambda based authorizer
1. set user password
2. get access token
3. validate access token
"""

import json
import boto3
import cognitojwt
import requests


USER_POOL_ID = 'ap-southeast-1_90C96FMkf'
APP_CLIENT_ID = '269b23sqm950h5m4l7q48kfn0k'
USER_EMAIL = 'hai@entest.io'
USER_NAME = 'dcda3e9f-036f-4aed-941a-28b1b087ac32'
PASSWORD = 'Mike@865525'

client = boto3.client('cognito-idp')


def set_user_password(setpass: str = "Mike@865525") -> None:
    """
    set permanent password for a user
    """
    res = client.admin_set_user_password(
        UserPoolId=USER_POOL_ID,
        Username=USER_NAME,
        Password=setpass,
        Permanent=True
    )
    print(res)


def get_access_token() -> str:
    """
    get token
    """
    resp = client.initiate_auth(
        ClientId=APP_CLIENT_ID,
        AuthFlow='USER_PASSWORD_AUTH',
        AuthParameters={
            "USERNAME": USER_NAME,
            "PASSWORD": PASSWORD
        }
    )
    print(resp)
    access_token = resp['AuthenticationResult']['AccessToken']
    # write toke to a file
    with open("token.json", "w") as file:
        file.write(json.dumps({"token": access_token}))
    return access_token


def verify_token() -> str:
    """
    verify token
    """
    # read token
    with open("token.json", "r") as file:
        dic = json.load(file)
        token = dic['token']
    # verify token
    try:
        claims: dict = cognitojwt.decode(
            token=token,
            region='ap-southeast-1',
            userpool_id=USER_POOL_ID,
            app_client_id=APP_CLIENT_ID,
        )
    except:
        claims: dict = {'token_use': 'FAIL'}
    print(claims)

    return claims


def test_auth_api():
    """
    test auth api
    """
    # read token
    with open("token.json", "r") as file:
        dic = json.load(file)
        token = dic['token']

    # send request with token
    response = requests.get(
        "https://ubky9s17pk.execute-api.ap-southeast-1.amazonaws.com/prod/book",
        headers={"Authorization": f'Bearer {token}'}
    )
    print(response.json())


if __name__ == "__main__":
    # get_access_token()
    # verify_token()
    test_auth_api()
