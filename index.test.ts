import sinon from 'sinon'
import { 
  UnitOfWorkObject, 
  UnitOfWorkTemplate 
} from './'

type Tx = any

class UowObject implements UnitOfWorkObject<Tx> {
  public createByTx() {
    return Promise.resolve()    
  }
  public updateByTx() {
    return Promise.resolve()
  }
  public deleteByTx() {
    return Promise.resolve()
  }
}

class Uow extends UnitOfWorkTemplate<Tx> {

  public constructor(public tx: Tx) {
    super()
  }
  public begin() {
    return Promise.resolve(this.tx)
  }
  public commit() {
    return Promise.resolve()
  }
  public rollback() {
    return Promise.resolve()
  }
  public release(tx: Tx) {
    return super.release(tx)
  }
  public create(obj: UnitOfWorkObject<Tx>) {
    return this.markCreate(obj)
  }
  public update(obj: UnitOfWorkObject<Tx>) {
    return this.markUpdate(obj)
  }
  public delete(obj: UnitOfWorkObject<Tx>) {
    return this.markDelete(obj)
  }
}

describe('uow', () => {
  const tx = {}

  describe('without beginWork declaration', () => {
    it('should create object when object is marked create', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objCreateByTx = sinon.spy(obj, 'createByTx')

      await uow.create(obj)

      expect(objCreateByTx.callCount).toBe(1)
      expect(objCreateByTx.calledOnceWithExactly(tx)).toBe(true)
    })

    it('should update object when object is marked update', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objUpdateByTx = sinon.spy(obj, 'updateByTx')

      await uow.update(obj)

      expect(objUpdateByTx.callCount).toBe(1)
      expect(objUpdateByTx.calledOnceWithExactly(tx)).toBe(true)
    })

    it('should delete object when object is marked delete', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objDeleteByTx = sinon.spy(obj, 'deleteByTx')

      await uow.delete(obj)

      expect(objDeleteByTx.callCount).toBe(1)
      expect(objDeleteByTx.calledOnceWithExactly(tx)).toBe(true)
    })
  })

  describe('with beginWork declaration', () => {
    it('should create object only when work is committed', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objCreateByTx = sinon.spy(obj, 'createByTx')

      uow.beginWork()
      await uow.create(obj)

      expect(objCreateByTx.callCount).toBe(0)

      await uow.commitWork()

      expect(objCreateByTx.callCount).toBe(1)
      expect(objCreateByTx.calledWithExactly(tx)).toBe(true)
    })

    it('should update object only when work is committed', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objUpdateByTx = sinon.spy(obj, 'updateByTx')

      uow.beginWork()
      await uow.update(obj)

      expect(objUpdateByTx.callCount).toBe(0)

      await uow.commitWork()

      expect(objUpdateByTx.callCount).toBe(1)
      expect(objUpdateByTx.calledWithExactly(tx)).toBe(true)
    })

    it('should delete object only when work is committed', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objDeleteByTx = sinon.spy(obj, 'deleteByTx')

      uow.beginWork()
      await uow.delete(obj)

      expect(objDeleteByTx.callCount).toBe(0)

      await uow.commitWork()

      expect(objDeleteByTx.callCount).toBe(1)
      expect(objDeleteByTx.calledWithExactly(tx)).toBe(true)
    })

    it('should do all actions only when work is committed', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objCreateByTx = sinon.spy(obj, 'createByTx')
      const objUpdateByTx = sinon.spy(obj, 'updateByTx')
      const objDeleteByTx = sinon.spy(obj, 'deleteByTx')

      uow.beginWork()
      await uow.create(obj)
      await uow.update(obj)
      await uow.delete(obj)

      expect(objCreateByTx.callCount).toBe(0)
      expect(objUpdateByTx.callCount).toBe(0)
      expect(objDeleteByTx.callCount).toBe(0)

      await uow.commitWork()

      expect(objCreateByTx.callCount).toBe(1)
      expect(objCreateByTx.calledWithExactly(tx)).toBe(true)

      expect(objUpdateByTx.callCount).toBe(1)
      expect(objUpdateByTx.calledWithExactly(tx)).toBe(true)

      expect(objDeleteByTx.callCount).toBe(1)
      expect(objDeleteByTx.calledWithExactly(tx)).toBe(true)
    })
  })

  describe('while committing', () => {
    it('should call uow commit with tx after all actions', async () => {
      const uow = new Uow(tx)
      const uowCommit = sinon.spy(uow, 'commit')
      const obj = new UowObject()
      const objCreateByTx = sinon.spy(obj, 'createByTx')
      const objUpdateByTx = sinon.spy(obj, 'updateByTx')
      const objDeleteByTx = sinon.spy(obj, 'deleteByTx')

      uow.beginWork()
      await uow.create(obj)
      await uow.update(obj)
      await uow.delete(obj)
      await uow.commitWork()

      expect(uowCommit.callCount).toBe(1)
      expect(uowCommit.calledWithExactly(tx)).toBe(true)
      expect(uowCommit.calledAfter(objCreateByTx)).toBe(true)
      expect(uowCommit.calledAfter(objUpdateByTx)).toBe(true)
      expect(uowCommit.calledAfter(objDeleteByTx)).toBe(true)
    })

    it('should call uow rollback with tx and throw error when error occurs', async () => {
      const uow = new Uow(tx)
      const uowRollback = sinon.spy(uow, 'rollback')
      const obj = new UowObject()
      const updateError = new Error('An error occurs while updating')

      sinon.stub(obj, 'updateByTx').throws(updateError)

      uow.beginWork()
      await uow.create(obj)
      await uow.update(obj)
      await uow.delete(obj)

      const checkCommitFail = () => uow.commitWork()

      await expect(checkCommitFail()).rejects.toThrow(updateError)
      expect(uowRollback.callCount).toBe(1)
      expect(uowRollback.calledWithExactly(tx)).toBe(true)
    })

    it('should not call uow rollback when no error occurs', async () => {
      const uow = new Uow(tx)
      const uowRollback = sinon.spy(uow, 'rollback')
      const obj = new UowObject()

      uow.beginWork()
      await uow.create(obj)
      await uow.update(obj)
      await uow.delete(obj)
      await uow.commitWork()

      expect(uowRollback.called).toBe(false)
    })

    it('should call uow release with tx when no error occurs after commit', async () => {
      const uow = new Uow(tx)
      const uowCommit = sinon.spy(uow, 'commit')
      const uowRelease = sinon.spy(uow, 'release')
      const obj = new UowObject()

      uow.beginWork()
      await uow.create(obj)
      await uow.commitWork()

      expect(uowRelease.callCount).toBe(1)
      expect(uowRelease.calledWithExactly(tx)).toBe(true)
      expect(uowRelease.calledAfter(uowCommit)).toBe(true)
    })

    it('should call uow release with tx when error occurs after rollback', async () => {
      const uow = new Uow(tx)
      const uowRollback = sinon.spy(uow, 'rollback')
      const uowRelease = sinon.spy(uow, 'release')
      const obj = new UowObject()
      const createError = new Error('An error occurs while creating')

      sinon.stub(obj, 'createByTx').throws(createError)

      uow.beginWork()
      await uow.create(obj)
      try {
        await uow.commitWork()
      } catch (e) {}

      expect(uowRelease.callCount).toBe(1)
      expect(uowRelease.calledWithExactly(tx)).toBe(true)
      expect(uowRelease.calledAfter(uowRollback)).toBe(true)
    })

    it('should reset uow state when commit succeeds', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const objCreateByTx = sinon.spy(obj, 'createByTx') 
      
      uow.beginWork()
      await uow.create(obj)
      await uow.commitWork()

      uow.beginWork()
      await uow.commitWork()

      expect(objCreateByTx.callCount).toBe(1)
    })

    it('should reset uow state when commit fails', async () => {
      const uow = new Uow(tx)
      const obj = new UowObject()
      const createError = new Error('An error occurs while creating')
      const objCreateByTx = sinon.stub(obj, 'createByTx').throws(createError)

      uow.beginWork()
      await uow.create(obj)
      try {
        await uow.commitWork()
      } catch (e) {}

      uow.beginWork()
      await uow.commitWork()

      expect(objCreateByTx.callCount).toBe(1)
    })
  })
})