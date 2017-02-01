/*
	"Boid" behavior algorithms for more natural entity movement.
	@author Corey Birnbaum http://coldconstructs.com/ @vonWolfehaus
*/
module.exports = {
	// cache of objects for reuse; there are a set for each function so they don't get overwritten
	_sumForce: new THREE.Vector3(),
	_desiredVec: new THREE.Vector3(),
	_scratchVec: new THREE.Vector3(),

	_wanderVec: new THREE.Vector3(),
	_seperationForce: new THREE.Vector3(),
	_cohereForce: new THREE.Vector3(),
	_alignForce: new THREE.Vector3(),
	_wanderAngle: 0,

	seek: function(agent, dest, slowingRadius) {
		var distance = agent.position.distanceTo(dest);
		slowingRadius = slowingRadius || 0;

		if (distance < 7) {
			// friction should bring the agent to a full stop
			agent.velocity.multiplyScalar(0.9);
			return;
		}

		this._desiredVec.copy(dest).sub(agent.position);
		this._desiredVec.normalize();

		if (distance < slowingRadius) {
			this._desiredVec.multiplyScalar(agent.maxForce * (distance / slowingRadius));
			agent.velocity.multiplyScalar(0.9); // apply friction to fight velocity (ie brake)
		}
		else {
			this._desiredVec.multiplyScalar(agent.maxForce);
		}

		agent.steeringForce.add(this._desiredVec);
	},

	flee: function(agent, dest) {
		this._desiredVec.copy(agent.position).sub(dest);
		this._desiredVec.normalize().multiplyScalar(agent.maxForce);

		agent.steeringForce.add(this._desiredVec);
	},

	align: function(agent, flock) {
		var a, distance, neighboursCount = 0;
		var node = flock.first;
		this._alignForce.x = 0;
		this._alignForce.z = 0;

		// for each of our neighbors (including self)...
		while (node) {
			a = node.obj.entity.boid;
			if (a.groupID !== agent.groupID) {
				node = node.next;
				continue;
			}

			distance = agent.position.distanceTo(a.position);
			// ...that are within the max distance and are moving...
			if (distance < agent.maxCohesion && a.velocity.getLength() > 0) {
				// ...sum up our headings
				this._scratchVec.copy(a.velocity);
				this._scratchVec.normalize();
				this._alignForce.add(this._scratchVec);
				// also check if they're where we want to be and call it good
				if (a._arrived) agent._arrived = true;
				neighboursCount++;
			}
			node = node.next;
		}

		if (neighboursCount === 0) {
			return this._alignForce; // zero
		}

		// divide to get the average heading
		this._alignForce.divideScalar(neighboursCount);
		this._alignForce.multiplyScalar(agent.maxForce);

		return this._alignForce;
	},

	cohere: function(agent, flock) {
		var a, distance,
			neighboursCount = 0,
			node = flock.first;

		this._sumForce.x = 0;
		this._sumForce.z = 0;

		while (node) {
			a = node.obj.entity.boid;
			if (a !== agent && a.groupID === agent.groupID) {
				distance = agent.position.distanceTo(a.position);
				if (distance < agent.maxCohesion) {
					// sum up the position of our neighbors
					this._sumForce.add(a.position);
					if (a._arrived) agent._arrived = true;
					neighboursCount++;
				}
			}
			node = node.next;
		}

		if (neighboursCount === 0) {
			this._cohereForce.x = 0;
			this._cohereForce.z = 0;
			return;
		}

		// get the average position of ourself and our neighbors
		this._sumForce.divideScalar(neighboursCount);

		// seek that position
		this._cohereForce.copy(this._sumForce).sub(agent.position);
		this._cohereForce.normalize().multiplyScalar(agent.maxForce);

		return this._cohereForce;
	},

	separate: function(agent, flock) {
		var neighboursCount = 0;
		var node = flock.first;

		this._seperationForce.x = 0;
		this._seperationForce.z = 0;

		while (node) {
			var a = node.obj.entity.boid;
			if (a !== agent) {
				var distance = agent.position.distanceTo(a.position);
				if (distance < agent.minSeparation && distance > 0) {
					// vector to other agent
					this._scratchVec.copy(a.position).sub(agent.position);
					// var length = this._scratchVec.normalize();
					var length = this._scratchVec.getLength();
					var r = agent.minSeparation + a.minSeparation;

					this._scratchVec.multiplyScalar(1 - ((length - r) / (agent.minSeparation - r)));
					this._seperationForce.x += this._scratchVec.x;
					this._seperationForce.z += this._scratchVec.z;

					neighboursCount++;
				}
			}
			node = node.next;
		}

		if (neighboursCount === 0) {
			return this._seperationForce;
		}

		this._seperationForce.multiplyScalar(agent.maxForce / neighboursCount);

		return this._seperationForce;
	},

	wander: function(agent) {
		this._desiredVec.copy(agent.velocity);
		this._desiredVec.normalize();
		this._desiredVec.multiplyScalar(agent.targetDistance);

		this._scratchVec.reset(0, -1);
		this._scratchVec.multiplyScalar(agent.targetRadius);
		this._scratchVec.setAngle(agent._wanderAngle);

		agent._wanderAngle += (Math.random() * agent.angleJitter) - (agent.angleJitter * 0.5);

		this._desiredVec.add(this._scratchVec);
		agent.steeringForce.add(this._desiredVec);
	},


	/*-------------------------------------------------------------------------------
									COMPOSITE BEHAVIORS
	-------------------------------------------------------------------------------*/

	flock: function(agent, flock) {
		this.separate(agent, flock);
		this.align(agent, flock);
		this.cohere(agent, flock);
		this._seperationForce.multiplyScalar(0.2);
		this._alignForce.multiplyScalar(1.3);
		this._cohereForce.multiplyScalar(0.6);
		agent.steeringForce.x += this._seperationForce.x + this._alignForce.x + this._cohereForce.x;
		agent.steeringForce.z += this._seperationForce.z + this._alignForce.z + this._cohereForce.z;
	},

	followPath: function(agent, path, repeat) {
		var target = path[agent._currentPathNode];
		if (!target) {
			agent._arrived = true;
			agent._currentPathNode = 0;
			return;
		}

		if (agent._arrived || agent.position.distanceTo(target) <= agent.pathArriveRadius) {
			agent._currentPathNode += agent._pathDir;
			agent._arrived = false;

			if (agent._currentPathNode >= path.length || agent._currentPathNode < 0) {
				if (repeat) {
					agent._pathDir *= -1;
					agent._currentPathNode += agent._pathDir;
				}
				else {
					agent._currentPathNode = path.length - 1;
					target = path[agent._currentPathNode];
					agent._arrived = true;
				}
			}
		}

		this.seek(agent, target, agent.slowingRadius);
	},

	pursue: function(agent, targetAgent) {
		// calculate future position of target
		this._scratchVec.copy(targetAgent.position).add(targetAgent.velocity);
		this._scratchVec.multiplyScalar(agent.distanceTo(targetAgent) / agent.maxForce);
		// and seek that instead
		this.seek(agent, this._scratchVec);
	},

	evade: function(agent, pursuingAgent) {
		this._scratchVec.copy(pursuingAgent.position).add(pursuingAgent.velocity);
		this._scratchVec.multiplyScalar(agent.distanceTo(pursuingAgent) / agent.maxForce);

		this.flee(agent, this._scratchVec);
	},

	/*followLeader: function(agent, leader, flock) {
		var tv :Vector3D = leader.velocity.clone();
		var force :Vector3D = new Vector3D();

		tv.normalize();
		tv.scaleBy(LEADER_BEHIND_DIST);

		ahead = leader.position.clone().add(tv);

		tv.scaleBy(-1);
		behind = leader.position.clone().add(tv);

		if (isOnLeaderSight(leader, ahead)) {
			alpha = 0.4;
			force = force.add(evade(leader));
			force.scaleBy(1.8); // make evade force stronger...
		} else {
			alpha = 1;
		}

		force = force.add(arrive(behind, 50));
		force = force.add(separation(agent, flock));

		agent.steeringForce.add(this._desiredVec);
	}*/
};
