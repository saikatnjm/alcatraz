# Alcatraz: developer shortcuts. Run "make help" for the list.
GNOME46_IMAGE ?= alcatraz-test:gnome46
GNOME51_IMAGE ?= alcatraz-test:gnome51

.PHONY: help build zip install uninstall test test-46 test-51 images check clean

help:
	@echo "make build      build both variants into build/"
	@echo "make zip        write the installable zips into dist/"
	@echo "make install    install for this user and switch it on (log out and in to load it)"
	@echo "make uninstall  switch it off and remove it"
	@echo "make test       lock and unlock a hidden GNOME Shell on this computer and check the lock screen"
	@echo "make test-46    the same in a container with GNOME 46 (see make images)"
	@echo "make test-51    the same in a container with GNOME 51"
	@echo "make images     build the two container images for the tests (about 1 GB each)"
	@echo "make check      run extensions.gnome.org's checker (Shexli) on the zips"
	@echo "make clean      remove build/ and dist/"

build:
	@tools/build.sh

zip:
	@tools/build.sh zip

install:
	@tools/install.sh

uninstall:
	@tools/install.sh remove

test:
	@tests/run.sh

test-46:
	@tests/in-container.sh $(GNOME46_IMAGE)

test-51:
	@tests/in-container.sh $(GNOME51_IMAGE)

images:
	docker build -t $(GNOME46_IMAGE) -f tests/Dockerfile.apt --build-arg BASE=ubuntu:24.04 tests
	docker build -t $(GNOME51_IMAGE) -f tests/Dockerfile.dnf --build-arg BASE=fedora:45 tests

check: zip
	@command -v shexli >/dev/null 2>&1 || { echo 'Install the checker first: pip install "git+https://gitlab.gnome.org/Infrastructure/extensions-web.git#subdirectory=shexli"'; exit 1; }
	@for zip in dist/alcatraz-$$(cat VERSION)-*.zip; do echo "== $$zip"; shexli "$$zip"; done

clean:
	@rm -rf build dist
