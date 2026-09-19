from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from community.models import CommunityPost, GameWishlist, Friendship
from community.friendship_services import reject_friend_request
from games.models import Game
from store.models import Order, LibraryItem
from chat.models import Conversation, Message
from users.models import User, Notification, WalletTransaction


class ReleaseSettingsTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username='release_alice', email='release_alice@example.test', password='Release-Pass-123!')
        self.bob = User.objects.create_user(username='release_bob', email='release_bob@example.test', password='Release-Pass-123!')
        self.game = Game.objects.create(title='Release game', description='Game', price=Decimal('20.00'), release_date=date(2026, 1, 1))
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def test_delete_requires_credentials_and_removes_associated_data(self):
        session = self.client.post('/api/auth/token/', {'email': self.alice.email, 'password': 'Release-Pass-123!'}, format='json').data
        order = Order.objects.create(user=self.alice, total_price='20.00', status='completed')
        LibraryItem.objects.create(user=self.alice, game=self.game, order=order, price_at_purchase="20.00")
        CommunityPost.objects.create(author=self.alice, kind='forum', title='My post', body='Content')
        conversation = Conversation.objects.create(user_low=self.alice, user_high=self.bob)
        Message.objects.create(conversation=conversation, sender=self.alice, body='Hello')
        for payload in ({'username': self.alice.username, 'password': 'wrong', 'confirmation':'DELETE'}, {'username':self.alice.username,'password':'Release-Pass-123!','confirmation':'NO'}):
            self.assertEqual(self.client.post('/api/settings/delete-account/',payload,format='json').status_code,400)
            self.assertTrue(User.objects.filter(pk=self.alice.pk).exists())
        response = self.client.post('/api/settings/delete-account/',{'username':self.alice.username,'password':'Release-Pass-123!','confirmation':'DELETE'},format='json')
        self.assertEqual(response.status_code,200)
        self.assertFalse(User.objects.filter(pk=self.alice.pk).exists())
        self.assertFalse(Order.objects.filter(pk=order.pk).exists())
        self.assertFalse(Conversation.objects.filter(pk=conversation.pk).exists())
        self.assertFalse(CommunityPost.objects.filter(author_id=self.alice.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.bob.pk).exists())
        other = APIClient()
        other.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access']}")
        self.assertEqual(other.get('/api/profile/').status_code,401)
        self.assertEqual(other.post('/api/auth/token/refresh/', {'refresh':session['refresh']}).status_code,401)

    def test_wallet_pagination_retains_complete_balance_and_user_scope(self):
        for n in range(25):
            WalletTransaction.objects.create(user=self.alice, amount='1.00', kind='topup', description='Top-up',event_key=f'release:{n}')
        WalletTransaction.objects.create(user=self.bob, amount='300.00', kind='topup',description='Other',event_key='release:other')
        first = self.client.get('/api/settings/wallet/').data
        second = self.client.get('/api/settings/wallet/?page=2').data
        self.assertEqual(first['balance'],'25.00')
        self.assertEqual(first['count'],25)
        self.assertEqual(len(first['transactions']),20)
        self.assertEqual(len(second['transactions']),5)
        self.assertFalse(set(x['id'] for x in first['transactions']) & set(x['id'] for x in second['transactions']))

    def test_sale_preferences_control_real_price_drop_events(self):
        GameWishlist.objects.create(user=self.alice,game=self.game)
        self.bob.notification_preferences={'store_sale':False}
        self.bob.save(update_fields=['notification_preferences'])
        self.game.price=Decimal('15.00'); self.game.save(update_fields=['price'])
        self.assertTrue(Notification.objects.filter(user=self.alice,kind='wishlist_sale').exists())
        self.assertFalse(Notification.objects.filter(user=self.bob,kind='store_sale').exists())
        self.alice.notification_preferences={'wishlist_sale':False}; self.alice.save(update_fields=['notification_preferences'])
        self.game.price=Decimal('10.00'); self.game.save(update_fields=['price'])
        self.assertEqual(Notification.objects.filter(user=self.alice,kind='wishlist_sale').count(),1)

    def test_news_only_notifies_owned_game_readers_on_publication(self):
        self.bob.is_staff=True; self.bob.save(update_fields=['is_staff'])
        LibraryItem.objects.create(user=self.alice,game=self.game, price_at_purchase="20.00")
        post = CommunityPost.objects.create(author=self.bob,game=self.game,kind='news',title='Update',body='Patch',is_published=False)
        self.assertFalse(Notification.objects.filter(user=self.alice,kind='news').exists())
        post.is_published=True; post.save(update_fields=['is_published'])
        post.title='Edited update'; post.save(update_fields=['title'])
        self.assertEqual(Notification.objects.filter(user=self.alice,kind='news').count(),1)

    def test_rejected_request_has_real_notification(self):
        relation=Friendship.objects.create(user_low=self.alice,user_high=self.bob,requested_by=self.alice)
        reject_friend_request(relationship_id=relation.pk,recipient=self.bob)
        self.assertTrue(Notification.objects.filter(user=self.alice,kind='friend_rejected').exists())

    def test_friend_activity_requires_friendship_and_public_activity(self):
        CommunityPost.objects.create(author=self.bob, kind='forum', title='Visible activity', body='Content')
        self.assertEqual(self.client.get('/api/friends/').data['activity'], [])
        Friendship.objects.create(user_low=self.alice,user_high=self.bob,requested_by=self.alice,status='accepted')
        self.assertEqual(len(self.client.get('/api/friends/').data['activity']), 1)
        base=f'/api/users/{self.alice.pk}/content/'
        self.assertEqual(self.client.get(base,{'section':'friends','search':'release_bob'}).data['count'],1)
        self.assertEqual(self.client.get(base,{'section':'friends','search':'release_alice'}).data['count'],0)
        self.bob.privacy_activity=False; self.bob.save(update_fields=['privacy_activity'])
        self.assertEqual(self.client.get('/api/friends/').data['activity'], [])

    def test_public_content_search_order_and_privacy(self):
        CommunityPost.objects.create(author=self.bob,kind='forum',title='Zephyr route',body='North')
        CommunityPost.objects.create(author=self.bob,kind='forum',title='Amber route',body='South')
        base=f'/api/users/{self.bob.pk}/content/'
        self.assertEqual(self.client.get(base,{'section':'discussions','search':'amber'}).data['count'],1)
        rows=self.client.get(base,{'section':'discussions','ordering':'title'}).data['results']
        self.assertEqual(rows[0]['title'],'Amber route')
        self.bob.privacy_activity=False; self.bob.save(update_fields=['privacy_activity'])
        self.assertEqual(self.client.get(base,{'section':'discussions','search':'amber'}).status_code,403)
