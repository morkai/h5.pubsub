var MessageBroker = require('../lib/MessageBroker');
var Sandbox = require('../lib/Sandbox');
var Subscription = require('../lib/Subscription');

describe("Sandbox", function()
{
  beforeEach(function()
  {
    this.mb = new MessageBroker();
    this.sb = this.mb.sandbox();
  });

  afterEach(function()
  {
    this.sb.destroy();
    this.mb.destroy();

    delete this.mb;
    delete this.sb;
  });

  describe("destroy", function()
  {
    it("should remove only listeners registered by the sandbox", function()
    {
      var sandboxHits = 0;
      var brokerHits = 0;

      this.sb.on('new topic', function() { ++sandboxHits; });
      this.mb.on('new topic', function() { ++brokerHits; });
      this.sb.destroy();
      this.mb.subscribe('a');

      sandboxHits.should.be.equal(0);
      brokerHits.should.be.equal(1);
    });

    it("should cancel only subscriptions made by the sandbox", function()
    {
      var actualCancelled = [];
      var expectedCancelled = [];

      this.mb.on('cancel', function(sub) { actualCancelled.push(sub); });
      this.mb.subscribe('a');
      this.mb.subscribe('broker.a');

      expectedCancelled.push(this.sb.subscribe('a'));
      expectedCancelled.push(this.sb.subscribe('sandbox.a'));

      this.sb.destroy();

      actualCancelled.should.be.eql(expectedCancelled);
    });

    it("should cancel subscriptions before removing listeners", function()
    {
      var cancelHits = 0;

      this.sb.on('cancel', function() { ++cancelHits; });
      this.sb.subscribe('a').on('cancel', function() { ++cancelHits; });

      this.sb.destroy();

      cancelHits.should.be.equal(2);
    });
  });

  describe("sandbox", function()
  {
    it("should return an instance of Sandbox bound to the creating Sandbox", function()
    {
      var sb = this.sb.sandbox();
      var messageHits = 0;

      sb.should.an.instanceOf(Sandbox);

      this.sb.on('message', function() { ++messageHits; });
      sb.publish('hello', 'world!');

      messageHits.should.equal(1);
    });
  });

  describe("publish", function()
  {
    it("should publish to parent broker", function()
    {
      var actualArgs = null;
      var expectedArgs = ['a', 'b', {a: 'b'}];

      this.mb.on('message', function()
      {
        actualArgs = Array.prototype.slice.call(arguments);
      });

      this.sb.publish.apply(this.sb, expectedArgs);

      actualArgs.should.be.eql(expectedArgs);
    });

    it("should return self", function()
    {
      this.sb.publish('a').should.be.equal(this.sb);
    });
  });

  describe("subscribe", function()
  {
    it("should add subscription for the specified topic", function()
    {
      var hits = 0;

      this.sb.on('new topic', function() { ++hits; });

      this.sb.subscribe('a');

      hits.should.be.equal(1);
    });

    it("should return an instance of Subscription with the specified topic", function()
    {
      var sub = this.sb.subscribe('a');

      sub.should.be.an.instanceOf(Subscription);
      sub.getTopic().should.be.equal('a');
    });

    it("should return an instance of Subscription with the specified message listener", function()
    {
      var hits = 0;

      var sub = this.sb.subscribe('a', function() { ++hits; });

      sub.should.be.an.instanceOf(Subscription);

      this.sb.publish('a');

      hits.should.be.equal(1);
    });
  });

  describe("unsubscribe", function()
  {
    it("should cancel subscription for the specified topic", function()
    {
      var hits = 0;

      this.sb.subscribe('a').on('cancel', function() { ++hits; });

      this.sb.unsubscribe('a');

      hits.should.be.equal(1);
    });

    it("should cancel all subscriptions for the specified topic", function()
    {
      var actualTopics = [];

      function hitTopic(_, topic) { actualTopics.push(topic); }

      this.sb.subscribe('a', hitTopic);
      this.sb.subscribe('a', hitTopic);
      this.sb.subscribe('b', hitTopic);

      this.sb.unsubscribe('a');

      this.sb.publish('a');
      this.sb.publish('b');

      actualTopics.should.be.eql(['b']);
    });

    it("should not cancel any subscriptions from the parent broker", function()
    {
      var actual = [];

      this.mb.subscribe('a', function() { actual.push('mb'); });
      this.sb.subscribe('a', function() { actual.push('sb'); });

      this.sb.unsubscribe('a');
      this.sb.publish('a');

      actual.should.be.eql(['mb']);
    });
  });

  describe("count", function()
  {
    it("should return a count of subscriptions by topic made by this sandbox", function()
    {
      this.mb.subscribe('a');
      this.mb.subscribe('b');
      this.sb.subscribe('a');
      this.sb.subscribe('a');
      this.sb.subscribe('b');
      this.sb.subscribe('c.d.e');

      this.sb.count().should.be.eql({
        'a': 2,
        'b': 1,
        'c.d.e': 1
      });
    });

    it("should include all subscriptions made by child sandboxes", function()
    {
      var sb = this.sb.sandbox();

      this.sb.subscribe('a');
      this.sb.subscribe('b');
      sb.subscribe('a');
      sb.subscribe('a');
      sb.subscribe('b');
      sb.subscribe('c.d.e');

      this.sb.count().should.be.eql({
        'a': 3,
        'b': 2,
        'c.d.e': 1
      });
    });

    it("should use hasOwnProperty", function()
    {
      Object.prototype.fakeSub = {
        getTopic: function() { return 'fake.topic'; }
      };

      this.sb.count().should.be.eql({});

      delete Object.prototype.fakeSub;
    });
  });

  describe("countAll", function()
  {
    it("should return a count of subscriptions by topic made by this sandbox and the parent broker", function()
    {
      this.mb.subscribe('a');
      this.mb.subscribe('b');
      this.sb.subscribe('a');
      this.sb.subscribe('a');
      this.sb.subscribe('b');
      this.sb.subscribe('c.d.e');

      this.sb.countAll().should.be.eql({
        'a': 3,
        'b': 2,
        'c.d.e': 1
      });
    });
  });

  describe("on", function()
  {
    it("should register the specified listeners", function()
    {
      var actual = [];

      this.sb.on('message', function() { actual.push('m1'); });
      this.sb.on('message', function() { actual.push('m2'); });

      this.sb.publish('a');

      actual.should.be.eql(['m1', 'm2']);
    });

    it("should register the specified listener on the parent broker", function()
    {
      var hits = 0;

      this.mb.on('message', function() { ++hits; });

      this.sb.publish('a');

      hits.should.be.equal(1);
    });

    it("should return self", function()
    {
      this.sb.on('message', function() {}).should.be.equal(this.sb);
    });
  });

  describe("off", function()
  {
    it("should remove only listeners registered in the sandbox", function()
    {
      var hits = 0;

      function hit() { ++hits; }

      this.mb.on('message', hit);
      this.sb.on('message', hit);

      this.sb.off('message', hit);
      this.sb.publish('a');

      hits.should.be.equal(1);
    });

    it("should return self if the specified listener was not registered", function()
    {
      this.sb.off('message', function() {}).should.be.equal(this.sb);
    });

    it("should return self if the specified listener was removed", function()
    {
      function cb() {}

      this.sb.on('message', cb);

      this.sb.off('message', cb).should.be.equal(this.sb);
    });
  });

  describe("emit", function()
  {
    it("should delegate to the parent's emit()", function()
    {
      var actualArgs = null;
      var expectedArgs = ['message', 'topic', 'hello world', {}];

      this.mb.emit = function()
      {
        actualArgs = Array.prototype.slice.call(arguments);
      };

      this.sb.emit.apply(this.sb, expectedArgs);

      actualArgs.should.be.eql(expectedArgs);
    });

    it("should return self", function()
    {
      this.sb.emit('message').should.be.equal(this.sb);
    });
  });
});