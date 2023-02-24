"""
haimtran 27 JUL 2022
get and validate cognito user token, then integrate with lambda based authorizer
1. setup config.json information for testing
2. set user permanent password
3. get access token and update config.json
4. validate access token using boto3
5. test api auth by requests
curl -H "Authorization: Bearer $token" $url 
"""

import json
import boto3
import cognitojwt
import requests

# cognito client
client = boto3.client('cognito-idp')

# this global will be updated by load_config
CONFIG = {}


def load_config() -> dict:
    """
    load config for testing
    """
    with open("config_1.json", "r") as file:
        config = json.load(file)
        print(config)
    return config


def set_user_password() -> None:
    """
    set permanent password for a user
    """
    res = client.admin_set_user_password(
        UserPoolId=CONFIG["USER_POOL_ID"],
        Username=CONFIG["USER_NAME"],
        Password=CONFIG["PASSWORD"],
        Permanent=True
    )
    print(res)


def get_access_token() -> str:
    """
    get token and update the config.json
    """
    resp = client.admin_initiate_auth(
        UserPoolId=CONFIG["USER_POOL_ID"],
        ClientId=CONFIG["APP_CLIENT_ID"],
        AuthFlow='ADMIN_NO_SRP_AUTH',
        AuthParameters={
            "USERNAME": CONFIG["USER_NAME"],
            "PASSWORD": CONFIG["PASSWORD"]
        }
    )
    print(resp)
    access_token = resp['AuthenticationResult']['AccessToken']
    id_token = resp['AuthenticationResult']['IdToken']
    # read current config
    current_config = load_config()
    # update token
    current_config['ACCESS_TOKEN'] = access_token
    current_config["ID_TOKEN"] = id_token
    with open("config_1.json", "w") as file:
        json.dump(current_config, file)
    return access_token


def verify_token() -> str:
    """
    verify token using boto3
    """
    # verify token
    try:
        claims: dict = cognitojwt.decode(
            token=CONFIG['token'],
            region='ap-southeast-1',
            userpool_id=CONFIG["USER_POOL_ID"],
            app_client_id=CONFIG["APP_CLIENT_ID"],
        )
    except:
        claims: dict = {'token_use': 'FAIL'}
    print(claims)

    return claims


def test_auth_api():
    """
    test auth api using request and jwt token
    """
    # send request with token
    response = requests.get(
        url=CONFIG["API_URL"],
        headers={"Authorization": f'Bearer {CONFIG["ACCESS_TOKEN"]}'}
    )
    print(response)
    print(response.json())


if __name__ == "__main__":
    CONFIG = load_config()
    # set_user_password()
    # get_access_token()
    # verify_token()
    test_auth_api()