from auth_kit.views import UserView as AuthKitUserView
from rest_framework import status
from rest_framework.response import Response


class UserView(AuthKitUserView):
    def delete(self, request, *args, **kwargs):
        """
        Delete the current user's account.
        """
        self.request.user.delete()
        return Response(
            {"detail": "User account deleted."}, status=status.HTTP_204_NO_CONTENT
        )
