"""Deterministic host tests. Not network or validator evidence."""
import sys, types, json, importlib.util, unittest, copy
from datetime import datetime

class Return:
    def __init__(self, value): self.calldata = value
class Map(dict):
    @classmethod
    def __class_getitem__(cls, _): return cls
fixture = 'Dist: noble\nName: Noble Numbat\nVersion: 24.04 LTS\nSupported: 1\n\nDist: bionic\nName: Bionic Beaver\nVersion: 18.04 LTS\nSupported: 0\n'
class Host:
    def __init__(self):
        self.message = types.SimpleNamespace(sender_address='0x'+'a'*40)
        self.message_raw = {'datetime': '2026-11-17T03:00:00Z'}
        self.public = types.SimpleNamespace(write=lambda fn:fn, view=lambda fn:fn)
        self.Contract = object
        self.body = fixture
        self.status = 200
        self.disagree = False
        self.nondet = types.SimpleNamespace(web=types.SimpleNamespace(get=self.get))
        self.vm = types.SimpleNamespace(Return=Return, run_nondet_unsafe=self.run)
    def get(self, url):
        assert url == 'https://changelogs.ubuntu.com/meta-release-lts'
        return types.SimpleNamespace(status=self.status, body=self.body.encode())
    def run(self, fetch, validate):
        value=fetch()
        if self.disagree or not validate(Return(value)): raise ValueError('NO_CONSENSUS')
        return value
host=Host()
mod=types.ModuleType('genlayer');mod.gl=host;mod.TreeMap=Map
sys.modules['genlayer']=mod
spec=importlib.util.spec_from_file_location('contract','contracts/supportgate.py');contract=importlib.util.module_from_spec(spec);spec.loader.exec_module(contract)

class Tests(unittest.TestCase):
    def setUp(self):
        host.message.sender_address='0x'+'a'*40;host.body=fixture;host.status=200;host.disagree=False
        self.c=contract.SupportGate();self.c.tickets=Map()
    def propose(self,ref='app-1',code='noble',digest='a'*64):
        return self.c.propose(ref,'Billing API',digest,code,'production')
    def load(self,id):return json.loads(self.c.get_ticket(id))
    def test_full_lifecycle_and_immutable_manifest(self):
        id=self.propose();self.assertEqual(self.load(id)['state'],'PROPOSED')
        self.c.evaluate(id);self.assertEqual(self.load(id)['state'],'READY')
        self.c.release(id,1);t=self.load(id);self.assertEqual(t['state'],'RELEASED');self.assertEqual(t['revision'],2);self.assertEqual(len(t['history']),2)
        self.assertEqual(t['artifact_sha256'],'a'*64)
        with self.assertRaisesRegex(ValueError,'TERMINAL_STATE'):self.c.evaluate(id)
        with self.assertRaisesRegex(ValueError,'NOT_READY'):self.c.release(id,2)
    def test_release_rechecks_and_denial_is_persisted(self):
        id=self.propose();self.c.evaluate(id);host.body=fixture.replace('Supported: 1','Supported: 0');self.c.release(id,1)
        t=self.load(id);self.assertEqual(t['state'],'BLOCKED');self.assertEqual(t['history'][-1]['action'],'RELEASE_BLOCKED')
    def test_unsupported_and_unknown_are_blocked(self):
        for i,code in enumerate(['bionic','invented']):
            id=self.propose('app-'+str(i),code);self.c.evaluate(id);self.assertEqual(self.load(id)['state'],'BLOCKED')
            with self.assertRaisesRegex(ValueError,'NOT_READY'):self.c.release(id,1)
    def test_only_owner_can_release_cancel_and_supersede(self):
        id=self.propose();self.c.evaluate(id);host.message.sender_address='0x'+'b'*40
        with self.assertRaisesRegex(ValueError,'OWNER_ONLY'):self.c.release(id,1)
        with self.assertRaisesRegex(ValueError,'OWNER_ONLY'):self.c.cancel(id)
    def test_stale_revision_and_replay(self):
        id=self.propose();self.c.evaluate(id);self.c.evaluate(id)
        with self.assertRaisesRegex(ValueError,'STALE_REVISION'):self.c.release(id,1)
        self.c.release(id,2)
        with self.assertRaisesRegex(ValueError,'NOT_READY'):self.c.release(id,2)
    def test_failures_leave_state_unchanged(self):
        id=self.propose();before=self.c.get_ticket(id)
        for mode in ['status','disagreement','malformed','duplicate']:
            host.status=503 if mode=='status' else 200;host.disagree=mode=='disagreement'
            host.body='bad response' if mode=='malformed' else fixture+fixture if mode=='duplicate' else fixture
            with self.assertRaises(ValueError):self.c.evaluate(id)
            self.assertEqual(self.c.get_ticket(id),before)
    def test_cancel_is_terminal(self):
        id=self.propose();self.c.cancel(id)
        with self.assertRaisesRegex(ValueError,'TERMINAL_STATE'):self.c.evaluate(id)
    def test_supersession_requires_matching_released_manifest(self):
        a=self.propose();self.c.evaluate(a);self.c.release(a,1)
        b=self.propose('app-2',digest='b'*64)
        with self.assertRaisesRegex(ValueError,'INVALID_REPLACEMENT'):self.c.supersede(a,b)
        self.c.evaluate(b);self.c.release(b,1);self.c.supersede(a,b)
        self.assertEqual(self.load(a)['superseded_by'],b);self.assertEqual(self.load(a)['state'],'SUPERSEDED')
        with self.assertRaisesRegex(ValueError,'NOT_RELEASED'):self.c.supersede(a,b)
    def test_validation(self):
        with self.assertRaisesRegex(ValueError,'INVALID_DIGEST'):self.propose(digest='a'*63)
        with self.assertRaisesRegex(ValueError,'INVALID_REFERENCE'):self.propose(ref='../x')
        id=self.propose()
        with self.assertRaisesRegex(ValueError,'DUPLICATE_REFERENCE'):self.propose()
        with self.assertRaisesRegex(ValueError,'INVALID_PAGE'):self.c.list_tickets(-1,50)
        self.assertEqual(json.loads(self.c.list_tickets(0,50))['total'],1)
    def test_source_parser_rejects_duplicate_fields_and_flag(self):
        for body in [fixture.replace('Supported: 1','Supported: 2'),fixture.replace('Supported: 1','Supported: 1\nSupported: 0')]:
            with self.assertRaises(ValueError):contract.parse_release(body,'noble')
        self.assertFalse(contract.parse_release(fixture,'unknown')['found'])
    def test_permissionless_evaluation_does_not_grant_release(self):
        id=self.propose();host.message.sender_address='0x'+'b'*40;self.c.evaluate(id)
        with self.assertRaisesRegex(ValueError,'OWNER_ONLY'):self.c.release(id,1)
