/**
 * scripts/Time.js — Nugget8 Ocean Scene
 * UNCHANGED from original.
 */
import { Clock, Uniform } from 'three'

export let time = 0
export let deltaTime = 0
export const timeUniform = new Uniform(time)

const clock = new Clock()

export function Start() {
  clock.start()
  time = clock.elapsedTime
  timeUniform.value = time
}

export function Update() {
  time = clock.elapsedTime
  deltaTime = clock.getDelta()
  timeUniform.value = time
}
