from rest_framework import status
from rest_framework.test import APISimpleTestCase


class HealthCheckTests(APISimpleTestCase):
    def test_health_endpoint_is_public(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})
