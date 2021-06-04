import Command from './command'
import history from '../history'
import { Data, GroupShape, Shape, ShapeType } from 'types'
import {
  getCommonBounds,
  getPage,
  getSelectedShapes,
  getShape,
} from 'utils/utils'
import { current } from 'immer'
import { createShape, getShapeUtils } from 'lib/shape-utils'
import { PropsOfType } from 'types'
import { v4 as uuid } from 'uuid'

export default function ungroupCommand(data: Data) {
  const cData = current(data)
  const { currentPageId, selectedIds } = cData

  const selectedGroups = getSelectedShapes(cData)
    .filter((shape) => shape.type === ShapeType.Group)
    .sort((a, b) => a.childIndex - b.childIndex)

  // Are all of the shapes already in the same group?
  // - ungroup the shapes
  // Otherwise...
  // - remove the shapes from any existing group and add them to a new one

  history.execute(
    data,
    new Command({
      name: 'ungroup_shapes',
      category: 'canvas',
      do(data) {
        const { shapes } = getPage(data)

        // Remove shapes from old parents
        for (const oldGroupShape of selectedGroups) {
          const siblings = (
            oldGroupShape.parentId === currentPageId
              ? Object.values(shapes).filter(
                  (shape) => shape.parentId === currentPageId
                )
              : shapes[oldGroupShape.parentId].children.map((id) => shapes[id])
          ).sort((a, b) => a.childIndex - b.childIndex)

          const trueIndex = siblings.findIndex((s) => s.id === oldGroupShape.id)

          let step: number

          if (trueIndex === siblings.length - 1) {
            step = 1
          } else {
            step =
              (siblings[trueIndex + 1].childIndex - oldGroupShape.childIndex) /
              (oldGroupShape.children.length + 1)
          }

          data.selectedIds.clear()

          // Move shapes to page
          oldGroupShape.children
            .map((id) => shapes[id])
            .forEach(({ id }, i) => {
              const shape = shapes[id]
              data.selectedIds.add(id)
              getShapeUtils(shape)
                .setProperty(shape, 'parentId', oldGroupShape.parentId)
                .setProperty(
                  shape,
                  'childIndex',
                  oldGroupShape.childIndex + step * i
                )
            })

          delete shapes[oldGroupShape.id]
        }
      },
      undo(data) {
        const { shapes } = getPage(data, currentPageId)
        selectedIds.clear()
        selectedGroups.forEach((group) => {
          selectedIds.add(group.id)
          shapes[group.id] = group
          group.children.forEach((id, i) => {
            const shape = shapes[id]
            getShapeUtils(shape)
              .setProperty(shape, 'parentId', group.id)
              .setProperty(shape, 'childIndex', i)
          })
        })
      },
    })
  )
}

function getShapeDepth(data: Data, id: string, depth = 0) {
  if (id === data.currentPageId) {
    return depth
  }

  return getShapeDepth(data, getShape(data, id).parentId, depth + 1)
}