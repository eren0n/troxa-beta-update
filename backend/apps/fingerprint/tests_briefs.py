from unittest import mock

from django.test import TestCase

from apps.accounts.models import User, Workspace
from apps.brand_kit.models import Campaign, Promo
from apps.fingerprint.models import CampaignMarketInsight
from apps.fingerprint.services import _run_creative_director


class CreativeDirectorSeesRealOffersTests(TestCase):
    """
    Agent 2 writes the extra_prompt a generation runs on, so an offer it makes
    up is rendered onto a creative as if the brand ran it. The autonomous path
    forbids inventing offers; briefs have to be held to the same rule, which
    means they have to be shown the real ones.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='p', email='p@q.com', password='x')
        self.ws = Workspace.objects.create(name='WS', owner=self.user)
        self.campaign = Campaign.objects.create(
            workspace=self.ws, name='Summer', target_audience='25-35', target_region='UK')
        self.insight = CampaignMarketInsight.objects.create(
            campaign=self.campaign, workspace=self.ws, status='ready', report={'x': 1})

    def promo(self, text):
        return Promo.objects.create(
            workspace=self.ws, file='promos/a.png', extracted_text=text, extraction_status='done')

    def user_prompt(self):
        """Run the director and return the prompt it built."""
        with mock.patch('apps.fingerprint.services._call_vision_creative_api',
                        return_value='{"director_note":"n","briefs":[]}') as api, \
             mock.patch('apps.fingerprint.services._get_brand_image_urls', return_value=[]):
            try:
                _run_creative_director(self.campaign, self.insight)
            except Exception:
                pass          # the schema may reject an empty brief list; the prompt is what matters
        return api.call_args.args[2] if api.call_args else ''

    def test_the_brands_offers_are_handed_over_verbatim(self):
        self.promo('CASHBACK | Up to 5% of your losses')
        self.promo('SIGN UP TO CLAIM | 100k GC | +1 SC FREE')
        prompt = self.user_prompt()
        self.assertIn('CASHBACK | Up to 5% of your losses', prompt)
        self.assertIn('100k GC', prompt)
        self.assertIn('BRAND OFFERS', prompt)

    def test_a_brand_kit_with_no_promos_says_so_and_bans_numbers(self):
        prompt = self.user_prompt()
        self.assertIn('BRAND OFFERS', prompt)
        self.assertIn('no promo artwork', prompt)
        self.assertIn('no brief may mention a bonus', prompt)

    def test_promos_still_being_read_are_not_offered_as_fact(self):
        # extraction unfinished — the text isn't trustworthy yet
        Promo.objects.create(workspace=self.ws, file='promos/b.png',
                             extracted_text='200% BONUS', extraction_status='pending')
        prompt = self.user_prompt()
        self.assertNotIn('200% BONUS', prompt)
        self.assertIn('no promo artwork', prompt)

    def test_another_workspaces_offers_never_leak_in(self):
        other_owner = User.objects.create_user(username='o', email='o@r.com', password='x')
        other = Workspace.objects.create(name='Other', owner=other_owner)
        Promo.objects.create(workspace=other, file='promos/c.png',
                             extracted_text='THEIR SECRET 500% DEAL', extraction_status='done')
        self.promo('OUR REAL OFFER | 10 SC')
        prompt = self.user_prompt()
        self.assertIn('OUR REAL OFFER', prompt)
        self.assertNotIn('500% DEAL', prompt)


class DirectorProhibitionsTests(TestCase):
    """The rules the brief writer is held to."""

    def test_inventing_an_offer_is_forbidden_in_so_many_words(self):
        from apps.fingerprint.prompts import CREATIVE_DIRECTOR_SYSTEM_PROMPT as sp
        self.assertIn('NEVER invent an offer', sp)
        self.assertIn('verbatim from BRAND OFFERS', sp)

    def test_writing_a_disclaimer_is_still_forbidden(self):
        from apps.fingerprint.prompts import CREATIVE_DIRECTOR_SYSTEM_PROMPT as sp
        self.assertIn('No legal or disclaimer text', sp)
