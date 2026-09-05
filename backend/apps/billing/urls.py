from django.urls import path
from .views import PlansView, SubscribeView, PlanView, CreditsView, TransactionsView

urlpatterns = [
    path('plans/', PlansView.as_view()),
    path('subscribe/', SubscribeView.as_view()),
    path('plan/', PlanView.as_view()),
    path('credits/', CreditsView.as_view()),
    path('transactions/', TransactionsView.as_view()),
]
