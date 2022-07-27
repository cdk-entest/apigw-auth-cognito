"""
docs 
"""

import json


def handler(event, context):
    """
    lambda backend
    """
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
        'body': json.dumps({
            'message': "hello api gateway auth"
        })
    }
