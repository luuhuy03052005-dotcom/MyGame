const PREFAB_HOUSE_IDS = new Set(
  'abcdefghijklmnopqrstu'.split('').map(letter => `prefab_house_${letter}`)
)

function isPrefabAsset(assetId) {
  return PREFAB_HOUSE_IDS.has(assetId)
}

function canPlace(gridManager, x, z) {
  const topCell = gridManager.getTopCell(x, z)
  return !topCell || (topCell.y === 0 && !topCell.metadata?.reservedBy)
}

function createPlan(gridManager, x, z, prefabId) {
  if (!isPrefabAsset(prefabId) || !canPlace(gridManager, x, z)) return null

  const entranceDirection = 2
  const prefabInstanceId = `${prefabId}:${x}_1_${z}`
  const driveway = { x, y: 0, z: z + 1 }
  const addCells = []
  const updateCells = []

  if (!gridManager.hasCell(x, 0, z)) {
    addCells.push({
      x,
      y: 0,
      z,
      material: 'stone_quay',
      metadata: {
        reservedBy: prefabInstanceId,
        reservationRole: 'prefab_footprint',
      },
    })
  } else {
    updateCells.push({
      x,
      y: 0,
      z,
      metadata: {
        reservedBy: prefabInstanceId,
        reservationRole: 'prefab_footprint',
      },
    })
  }

  addCells.push({
    x,
    y: 1,
    z,
    material: 'suburban',
    metadata: {
      prefabId,
      prefabInstanceId,
      prefabRotation: 0,
      prefabScale: 1.08,
      entranceSide: 'south',
      footprint: [{ x, y: 0, z }],
    },
  })

  const drivewayTop = gridManager.getTopCell(driveway.x, driveway.z)
  if (!drivewayTop) {
    addCells.push({
      ...driveway,
      material: 'stone_quay',
      metadata: {
        surfaceAssetType: 'surface_entrance',
        surfaceRole: 'entrance',
        surfaceDirection: entranceDirection,
      },
    })
  } else if (drivewayTop.y === 0) {
    updateCells.push({
      x: driveway.x,
      y: 0,
      z: driveway.z,
      metadata: {
        surfaceAssetType: 'surface_entrance',
        surfaceRole: 'entrance',
        surfaceDirection: entranceDirection,
      },
    })
  }

  return {
    prefabId,
    entranceDirection,
    addCells,
    updateCells,
    affectedPositions: [
      { x, y: 0, z },
      { x, y: 1, z },
      driveway,
    ],
  }
}

const PrefabPlacementMode = {
  isPrefabAsset,
  canPlace,
  createPlan,
}

export { PrefabPlacementMode }
