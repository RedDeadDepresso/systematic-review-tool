import pytest
from rest_framework.test import APIRequestFactory


class TestUserViewSet:
    @pytest.fixture
    def api_rf(self) -> APIRequestFactory:
        return APIRequestFactory()

    # def test_get(self, user: User, api_rf: APIRequestFactory):
    #     view = UserView.as_view()

    #     request = api_rf.get("/fake-url/")
    #     request.user = user

    #     response = view(request)
    #     print(response.data)

    #     assert response.data["first_name"] == user.first_name
