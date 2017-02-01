/*
	you'll often see a "world" object in games that hold entities, and it's purpose is to provide data about
	the world and make entities aware of one another within it, efficiently.
	this one uses a static grid for spatial hashing in a very memory-efficient manner by pooling grid "cells"
	(just doubly-linked lists) so if no object occupies a cell, it will be freed and used elsewhere.
	due to this feature, an adjacent possibility opens up: it can extend to infinity at virtually no cost. it
	will grow as needed and reuse what isn't.
	if your game only has a couple dozen colliding entities, it would be more efficient to use the brute-force
	method, as there is some overhead to maintaining these lists per frame.
	querying is the second-best aspect of grids--if you have a trigger or dynamic object (like a bullet) that
	doesn't react physically, then it can simply go through the cells it occupies looking for something it wants.
 */
var World = function() {
	var TileAABB = require('../entities/TileAABB');
	var g = game.grid;
	var b = game.board;

	this.boundingBox = new THREE.Box3().setFromObject(b.tileGroup);
	// this.cellOffsetX = -this.boundingBox.min.x;
	// this.cellOffsetZ = -this.boundingBox.min.z;

	this.tilesPerWorldCell = 3; // how many tiles fit in a world/broadphase cell
	// World.TILES_TO_WORLDCELL = 1 / this.tilesPerWorldCell; // convert for faster computation

	var cellSize = g.cellSize * this.tilesPerWorldCell; // how big the collision grid cells are
	var worldCellsInitCacheSize = 2;

	this.worldCellSize = cellSize;
	World.PX_TO_GRID = 1 / cellSize;

	this.active = true;

	this.bounded = true;
	// universal properties all entities abide by (applied in physics component)
	this.friction = 0.8;
	this.gravity = new THREE.Vector3(0, -1, 0); // -2
	// elapsed will probably sit elsewhere in your game, just find-replace with your own
	this.elapsed = 0.0166;
	/*
		sparse array of LinkedLists. and even if a cell is there, doesn't mean it's active!
		always use this.getCell() to ensure you get a legit cell to use for querying
	 */
	this.broadphaseGrid = [];
	/*
		world bounds. subtracts min from entity position to shift grid to avoid negative numbers,
		so we never try to reach outside this.broadphaseGrid array.
	 */
	this.min = this.boundingBox.min;
	this.max = this.boundingBox.max;

	this.objects = new vgp.LinkedList(); // collision objects occupying the world/broadphase cells

	this._listPool = new vgp.ObjectPool(vgp.LinkedList, null, 20); //worldCellsInitCacheSize
	this._tilePool = new mh.DualPool(TileAABB, null, this.tilesPerWorldCell * this.tilesPerWorldCell * 2); //worldCellsInitCacheSize
	this._emptyCell = new vgp.LinkedList(); // faster return for empty queries

	this._tileSize = g.cellSize;
	this._vec = new THREE.Vector3();

	if (game.debug) {
		// debug stuff, comment out before release
		/*// this._scratchVec = new vgp.Vec();
		var cubeGeo = new THREE.CubeGeometry(this.max.x, this.max.y, this.max.z);
		var cubeMaterial = new THREE.MeshBasicMaterial({
			color: 0x08e26c,
			wireframe: true,
			shading: THREE.FlatShading
		});
		this._debugMesh = new THREE.Mesh(cubeGeo, cubeMaterial);
		this.position = this._debugMesh.position;
		mh.kai.view.add(this._debugMesh);*/

		var box = new THREE.BoxHelper(b.tileGroup, 0xffff00);
		mh.kai.view.add(box);
	}
};

World.PX_TO_GRID = 0;
// World.TILES_TO_WORLDCELL = 0;

World.prototype = {
	constructor: World,

	// _sortedLayer: null,

	/*-------------------------------------------------------------------------------
									PUBLIC
	-------------------------------------------------------------------------------*/

	/*countGroup: function(groupType) {
		var obj, node = this.objects.first;
		var total = 0;
		while (node) {
			obj = node.obj;
			if (obj.active && obj.collisionGroup === groupType) {
				total++;
			}
			node = node.next;
		}
		return total;
	},*/

	// e must be an entity with a collision body or the body itself, like an AABB
	add: function(e) {
		e = e.body || e;
		if (!e.collisionID) {
			console.warn('[vgp.World.add] Ignoring object; must be an entity or physics component');
			console.dir(e);
			return;
		}
		this.objects.add(e);
	},

	remove: function(e) {
		e = e.body || e;
		// harmless: if it doesn't exist, will return silently
		this.objects.remove(e);
	},

	/*
		all entities should have been updated before this is called so it has the latest position data.
	 */
	update: function() {
		var manifold, obj, node, otherObj, other, boardCell;
		var cZEntityMin,cZEntityMax,cXEntityMin,cZEntityMax,i,j,cZ,cX,gridCol,gridCell;

		// make all cells and blocks usable again so we start fresh with empty cells - that's how we take care of entities moving out of old cells
		node = this._listPool.busy.first;
		while (node) {
			obj = node.obj;
			node = node.next;
			obj.clear(); // clear out any entitise that were in this cell
			obj.active = false; // mark this cell as empty of tiles
		}

		this._tilePool.freeAll();
		this._vec.y = 0;
		var count = 0;

		// add all active objects to appropriate cells and resolve collisions among them
		node = this.objects.first;
		while (node) {
			obj = node.obj;
			node = node.next;

			if (!obj.solid || !obj.active) {
				continue;
			}

			// subtract min to shift grid to avoid negative numbers
			cXEntityMin = Math.floor(obj.min.x * World.PX_TO_GRID);
			cXEntityMax = Math.floor(obj.max.x * World.PX_TO_GRID);
			cZEntityMin = Math.floor(obj.min.z * World.PX_TO_GRID);
			cZEntityMax = Math.floor(obj.max.z * World.PX_TO_GRID);

			// insert entity into each cell it overlaps
			// we're looping to make sure that all cells between min/max are found (in case the entity is on the border between cells, or larger than an entire cell)
			for (cZ = cZEntityMin; cZ <= cZEntityMax; cZ++) {
				// these only get created once per world init on an as-needed basis (allows for worlds of infinite size without eating All The RAM)
				gridCol = this.broadphaseGrid[cZ];
				if (!gridCol) {
					gridCol = [];
					this.broadphaseGrid[cZ] = gridCol;
				}
				// loop through each cell in this column
				for (cX = cXEntityMin; cX <= cXEntityMax; cX++) {
					gridCell = gridCol[cX];
					// ensure we have a bucket to put entities into for this cell
					if (!gridCell) {
						// this is also only done once per world init to ensure that only used cells get allocated
						gridCell = this._listPool.get();
						gridCell.active = false; // set it to false so it gets populated with collision blocks
						gridCol[cX] = gridCell;
					}
					// if this cell doesn't already have blocks (from a previous entity that's also occupying it this frame) then activate them for this cell
					if (!gridCell.active) {
						// fill this cell with blocks so entities know where the ground is - this is only done once per frame
						// having this boolean allows us to avoid allocating new arrays every tick
						gridCell.active = true;
						i = cX * this.worldCellSize;
						j = cZ * this.worldCellSize;
						// i'm sure there's something far more efficient, but this is Good Enough - i have the rest of the game to make
						this._vec.x = i;
						this._vec.z = j;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize;
						this._vec.z = j;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize + this._tileSize;
						this._vec.z = j;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i;
						this._vec.z = j + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize;
						this._vec.z = j + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize + this._tileSize;
						this._vec.z = j + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i;
						this._vec.z = j + this._tileSize + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize;
						this._vec.z = j + this._tileSize + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}

						this._vec.x = i + this._tileSize + this._tileSize;
						this._vec.z = j + this._tileSize + this._tileSize;
						boardCell = game.grid.getCellAt(this._vec);
						if (boardCell) {
							block = this._tilePool.get();
							block.activate(boardCell);
							gridCell.add(block);
						}
					}

					// loop again to check collisions with entities already in this cell before adding ourselves
					other = gridCell.first;
					while (other) {
						otherObj = other.obj;
						other = other.next;

						if (otherObj.collisionID === obj.collisionID) {
							// prevents static objects from colliding into other static objects, such as tiles
							continue;
						}
						/*
							no hash check for duplicates since the collision check would have moved them out of intersection and therefore fail (early, at that) the next time, making it impossible to apply impulses multiple times. anyway, a hash would thrash the gc (since it has to be recreated each frame).
						*/
						manifold = vgp.physics.separateAABB3AABB3(obj, otherObj);
						if (manifold) {
							vgp.physics.resolve(obj, otherObj, manifold);

							if (obj.onCollision) obj.onCollision.dispatch(otherObj, manifold);
							if (otherObj.onCollision) otherObj.onCollision.dispatch(obj, manifold);
						}
					}
					gridCell.add(obj);
				}
			}
		}
	},

	/*
		only to be used for queries, never modify the cells directly!
	 */
	getCell: function(px, py) {
		px = Math.floor(px * World.PX_TO_GRID);
		py = Math.floor(py * World.PX_TO_GRID);
		if (this.broadphaseGrid[px] && this.broadphaseGrid[px][py] && this._listPool.busy.has(this.broadphaseGrid[px][py])) {
			// must exist and be in use, otherwise it could exist but contain old data
			return this.broadphaseGrid[px][py];
		}
		return this._emptyCell;
	},

	/*
		get a number of cells and put them in an array that must be provided.
		again, never modify the cells, only loop through them for their occupants!
	 */
	getCells: function(px, py, w, h, arr) {
		var cZ, cX, maxX, maxY, gridCol, gridCell, ptg = World.PX_TO_GRID;
		px = Math.floor(px * ptg);
		py = Math.floor(py * ptg);
		maxX = px + Math.floor(w * ptg);
		maxY = py + Math.floor(h * ptg);
		for (cZ = px; cZ <= maxX; cZ++) {
			// make sure a column exists, initialize if not to grid height length
			if (!this.broadphaseGrid[cZ]) {
				// if the column doesn't exist, there's nothing in it, so move on
				continue;
			}
			gridCol = this.broadphaseGrid[cZ];

			// loop through each cell in this column
			for (cX = py; cX <= maxY; cX++) {
				if (!gridCol[cX]) {
					continue;
				}
				gridCell = this.broadphaseGrid[cZ][cX];
				// finally, make sure this isn't a ghost reference by checking if it's in use
				if (this._listPool.busy.has(gridCell)) {
					arr.push(gridCell);
				}
			}
		}
		return arr;
	},

	disable: function() {
		this.active = false;
	},

	dispose: function() {
		this.objects.dispose();
		this.objects = null;
		this.broadphaseGrid = null;
		this.min = null;
		this.max = null;
		this._emptyCell = null;
	}
};

module.exports = World;
