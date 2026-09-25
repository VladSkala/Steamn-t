from django.conf import settings
from django.http import HttpResponse
from django.utils.cache import patch_vary_headers


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        is_api_request = request.path.startswith("/api/")
        allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])

        origin_allowed = (
            is_api_request
            and origin
            and origin in allowed_origins
        )

        if request.method == "OPTIONS" and origin_allowed:
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if origin_allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response["Access-Control-Allow-Headers"] = (
                "Authorization, Content-Type, Accept, "
                "X-CSRFToken, X-Requested-With"
            )
            response["Access-Control-Max-Age"] = "86400"

            patch_vary_headers(response, ["Origin"])

        return response
